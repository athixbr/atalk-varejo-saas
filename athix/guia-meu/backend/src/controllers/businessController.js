const { 
  Business, 
  Category, 
  Tag, 
  City,
  BusinessGallery,
  BusinessSchedule,
  BusinessCourse,
  User
} = require('../models');
const slugify = require('slugify');
const { Op, UniqueConstraintError } = require('sequelize');
const { isBusinessOpenNow } = require('../utils/businessHours');

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PUBLIC_LIST_LIMIT_MAX = toPositiveInt(process.env.PUBLIC_LIST_LIMIT_MAX, 100);
const SEARCH_TOKEN_LIMIT = toPositiveInt(process.env.SEARCH_TOKEN_LIMIT, 5);
const SEARCH_MATCH_LIMIT = toPositiveInt(process.env.SEARCH_MATCH_LIMIT, 1000);
const SEARCH_TERM_MAX_LENGTH = toPositiveInt(process.env.SEARCH_TERM_MAX_LENGTH, 80);
const OPEN_NOW_CANDIDATE_LIMIT = toPositiveInt(process.env.OPEN_NOW_CANDIDATE_LIMIT, 1000);
const ENABLE_PUBLIC_REQUEST_LOGS = process.env.ENABLE_PUBLIC_REQUEST_LOGS === 'true';

const normalizeSearchTerm = (value) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_TERM_MAX_LENGTH);
};

const escapeLikeTerm = (value) => value.replace(/[\\%_]/g, '\\$&');

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalTextForUpdate = (value) => {
  if (value === undefined) return undefined;
  return normalizeOptionalText(value);
};

// @desc    Listar todas as empresas
// @route   GET /api/v1/businesses
// @access  Public
const getAllBusinesses = async (req, res) => {
  try {
    const { 
      page = 1, 
      cityId,
      categoryId,
      plan,
      featured,
      search,
      deliveryAvailable,
      openNow,
      sortBy = 'rating'
    } = req.query;

    // Construir filtros
    const where = { active: true, approved: true };

    if (cityId) where.cityId = cityId;
    if (plan) where.plan = plan;
    if (featured === 'true') where.featured = true;
    if (deliveryAvailable === 'true') where.deliveryAvailable = true;
    const filterOpenNow = openNow === 'true';
    
    if (ENABLE_PUBLIC_REQUEST_LOGS) {
      console.log('getAllBusinesses - filtros aplicados:', where);
    }

    const normalizedSearch = normalizeSearchTerm(search);

    if (normalizedSearch.length >= 2) {
      // Tokeniza a busca: cada palavra deve casar (AND) em pelo menos um dos
      // campos nome/descrição/categoria/tag (OR). Isso permite achar
      // "supermercado" mesmo quando o nome da empresa só tem "mercado" no
      // texto mas está na categoria "Supermercados", e vice-versa.
      const words = normalizedSearch
        .split(/\s+/)
        .filter((word) => word.length >= 2)
        .slice(0, SEARCH_TOKEN_LIMIT)
        .map(escapeLikeTerm);

      const matches = await Business.findAll({
        attributes: [[Business.sequelize.fn('DISTINCT', Business.sequelize.col('Business.id')), 'id']],
        include: [
          { model: Category, as: 'Categories', attributes: [], through: { attributes: [] }, required: false },
          { model: Tag, as: 'Tags', attributes: [], through: { attributes: [] }, required: false }
        ],
        where: {
          ...where,
          [Op.and]: words.map((word) => ({
            [Op.or]: [
              { '$Business.name$': { [Op.like]: '%' + word + '%' } },
              { '$Business.description$': { [Op.like]: '%' + word + '%' } },
              { '$Categories.name$': { [Op.like]: '%' + word + '%' } },
              { '$Tags.name$': { [Op.like]: '%' + word + '%' } }
            ]
          }))
        },
        subQuery: false,
        limit: SEARCH_MATCH_LIMIT,
        raw: true
      });

      const matchingIds = [...new Set(matches.map((m) => m.id))];
      where.id = { [Op.in]: matchingIds.length > 0 ? matchingIds : [-1] };
    } else if (search !== undefined) {
      where.id = { [Op.in]: [-1] };
    }

    // Incluir relacionamentos
    const include = [
      {
        model: City,
        as: 'City',
        attributes: ['id', 'name', 'slug']
      },
      {
        model: Category,
        as: 'Categories',
        through: { attributes: [] },
        attributes: ['id', 'name', 'slug', 'icon']
      },
      {
        model: Tag,
        as: 'Tags',
        through: { attributes: [] },
        attributes: ['id', 'name', 'slug']
      },
      {
        model: BusinessSchedule,
        as: 'schedules',
        attributes: ['id', 'scheduleText', 'displayOrder'],
        separate: true,
        order: [['displayOrder', 'ASC']]
      },
      {
        model: BusinessGallery,
        as: 'gallery',
        attributes: ['id', 'fileUrl', 'fileType', 'title', 'displayOrder'],
        separate: true,
        order: [['displayOrder', 'ASC']]
      }
    ];

    // Se filtrar por categoria específica
    if (categoryId) {
      include[1].where = { id: categoryId };
      include[1].required = true;
    }

    // Ordenação (sempre com tiebreaker por id para garantir paginação estável)
    let order;
    switch(sortBy) {
      case 'name':
        order = [['name', 'ASC'], ['id', 'ASC']];
        break;
      case 'newest':
      case 'recent':
        order = [['createdAt', 'DESC'], ['id', 'DESC']];
        break;
      case 'views':
        order = [['views', 'DESC'], ['id', 'DESC']];
        break;
      case 'rating':
      default:
        order = [
          ['featured', 'DESC'],
          ['plan', 'DESC'],
          ['rating', 'DESC'],
          ['id', 'DESC']
        ];
    }
    
    const requestedLimit = parseInt(req.query.limit, 10);
    const limitVal = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, PUBLIC_LIST_LIMIT_MAX)
      : 24;
    const pageVal  = Math.max(parseInt(page) || 1, 1);
    const offset   = (pageVal - 1) * limitVal;

    let count, businesses;

    if (filterOpenNow) {
      // Não há SQL confiável para "aberto agora" (open_time/close_time não são
      // preenchidos no cadastro); os horários reais ficam em texto livre nos
      // schedules, então filtramos em memória após buscar todos os candidatos.
      const all = await Business.findAll({
        where,
        include,
        order,
        distinct: true,
        limit: Math.min(offset + limitVal, OPEN_NOW_CANDIDATE_LIMIT)
      });
      const now = new Date();
      const filtered = all.filter((b) => isBusinessOpenNow(b.schedules, now));
      count = filtered.length;
      businesses = filtered.slice(offset, offset + limitVal);
    } else {
      const queryOptions = {
        where,
        include,
        order,
        distinct: true,
        limit: limitVal,
        offset,
      };
      const result = await Business.findAndCountAll(queryOptions);
      count = result.count;
      businesses = result.rows;
    }

    const totalPages = Math.ceil(count / limitVal) || 1;

    if (ENABLE_PUBLIC_REQUEST_LOGS) {
      console.log(`getAllBusinesses - ${count} total | pagina ${pageVal}/${totalPages} | retornando ${businesses.length}`);
    }

    res.json({
      success: true,
      count,
      totalPages,
      currentPage: pageVal,
      data: businesses
    });
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar empresas'
    });
  }
};

// @desc    Buscar empresa por ID ou slug
// @route   GET /api/v1/businesses/:id
// @access  Public
const getBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se é um número (ID) ou string (slug)
    const isNumeric = !isNaN(id);
    const whereClause = isNumeric ? { id } : { slug: id };
    whereClause.active = true;

    const business = await Business.findOne({
      where: whereClause,
      include: [
        {
          model: City,
          as: 'City',
          attributes: ['id', 'name', 'slug', 'state']
        },
        {
          model: Category,
          as: 'Categories',
          through: { attributes: [] },
          attributes: ['id', 'name', 'slug', 'icon']
        },
        {
          model: Tag,
          as: 'Tags',
          through: { attributes: [] },
          attributes: ['id', 'name', 'slug']
        },
        {
          model: BusinessGallery,
          as: 'gallery',
          attributes: ['id', 'fileType', 'fileUrl', 'displayOrder', 'title'],
          separate: true,
          order: [['displayOrder', 'ASC']]
        },
        {
          model: BusinessSchedule,
          as: 'schedules',
          attributes: ['id', 'scheduleText', 'displayOrder'],
          separate: true,
          order: [['displayOrder', 'ASC']]
        },
        {
          model: BusinessCourse,
          as: 'courses',
          attributes: ['id', 'name', 'duration', 'description', 'price', 'displayOrder'],
          separate: true,
          order: [['displayOrder', 'ASC']]
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Empresa não encontrada'
      });
    }

    // Incrementar views
    await business.increment('views');

    res.json({
      success: true,
      data: business
    });
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar empresa'
    });
  }
};

// @desc    Criar nova empresa
// @route   POST /api/v1/businesses
// @access  Private
const createBusiness = async (req, res) => {
  try {
    const {
      name,
      description,
      phone,
      phoneSecondary,
      video,
      email,
      website,
      facebook,
      instagram,
      whatsapp,
      linkedin,
      twitter,
      youtube,
      tiktok,
      address,
      latitude,
      longitude,
      cityId,
      plan = 'free',
      featured,
      categoryIds = [],
      tagIds = [],
      deliveryAvailable,
      deliveryFee,
      deliveryTime,
      metaTitle,
      metaDescription
    } = req.body;

    // Validações
    if (!name || !phone || !address || !cityId) {
      return res.status(400).json({
        success: false,
        error: 'Nome, telefone, endereço e cidade são obrigatórios'
      });
    }

    // Verificar se cidade existe
    const city = await City.findByPk(cityId);
    if (!city) {
      return res.status(404).json({
        success: false,
        error: 'Cidade não encontrada'
      });
    }

    // Admin regional só pode criar empresas na sua cidade
    if (req.managedCityId && parseInt(cityId) !== req.managedCityId) {
      return res.status(403).json({
        success: false,
        error: 'Você só pode criar empresas na sua cidade gerenciada'
      });
    }

    // Gerar slug único
    let slug = slugify(name, {
      lower: true,
      strict: true,
      locale: 'pt'
    });

    // Verificar se slug já existe e incrementar até encontrar um único
    let existingBusiness = await Business.findOne({ where: { slug } });
    let counter = 1;
    const baseSlug = slug;
    
    while (existingBusiness) {
      slug = `${baseSlug}-${counter}`;
      existingBusiness = await Business.findOne({ where: { slug } });
      counter++;
      
      // Prevenir loop infinito (máximo 100 tentativas)
      if (counter > 100) {
        return res.status(500).json({
          success: false,
          error: 'Não foi possível gerar um slug único para esta empresa'
        });
      }
    }

    console.log('✅ Slug único gerado:', slug);

    // Coerce valores e defaults antes de criar
    const deliveryAvailableFlag = deliveryAvailable === 'true' || deliveryAvailable === true || deliveryAvailable === 1 || deliveryAvailable === '1';
    const featuredFlag = featured === 'true' || featured === true || featured === 1 || featured === '1';
    const planExpires = plan === 'premium' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
    const approvedFlag = req.user.role === 'admin'; // Auto-aprovar se for admin
    const phoneSecondaryNormalized = normalizeOptionalText(phoneSecondary);
    const videoNormalized = normalizeOptionalText(video);
    const emailNormalized = normalizeOptionalText(email);
    const websiteNormalized = normalizeOptionalText(website);

    console.log('🔍 Flags calculadas:', {
      deliveryAvailable: deliveryAvailableFlag,
      featured: featuredFlag,
      approved: approvedFlag,
      plan
    });

    // Criar empresa (tratamento de duplicidade de slug)
    let business;
    try {
      business = await Business.create({
        userId: req.user.id,
        cityId,
        name,
        slug,
        description,
        phone,
        phoneSecondary: phoneSecondaryNormalized,
        video: videoNormalized,
        email: emailNormalized,
        website: websiteNormalized,
        facebook: facebook || null,
        instagram: instagram || null,
        whatsapp: whatsapp || null,
        linkedin: linkedin || null,
        twitter: twitter || null,
        youtube: youtube || null,
        tiktok: tiktok || null,
        address,
        latitude,
        longitude,
        plan,
        planExpiresAt: planExpires,
        featured: featuredFlag,
        deliveryAvailable: deliveryAvailableFlag,
        deliveryFee,
        deliveryTime,
        metaTitle: metaTitle || name,
        metaDescription: metaDescription || description || '',
        active: true,
        approved: approvedFlag,
        registrationSource: 'admin' // ORIGEM: PAINEL ADMIN
      });
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        console.warn('⚠️ Tentativa de criar empresa com slug duplicado:', slug);
        return res.status(409).json({
          success: false,
          error: 'Já existe uma empresa com esse nome/slug. Tente outro nome.'
        });
      }
      throw err; // será capturado pelo catch externo
    }

    // Associar categorias
    if (categoryIds.length > 0) {
      const categories = await Category.findAll({
        where: { id: categoryIds }
      });
      await business.setCategories(categories);
    }

    // Associar tags
    if (tagIds.length > 0) {
      const tags = await Tag.findAll({
        where: { id: tagIds }
      });
      await business.setTags(tags);
    }

    // Buscar empresa completa para retornar
    const newBusiness = await Business.findByPk(business.id, {
      include: [
        { model: Category, as: 'Categories', through: { attributes: [] } },
        { model: Tag, as: 'Tags', through: { attributes: [] } },
        { model: City, as: 'City' }
      ]
    });

    res.status(201).json({
      success: true,
      data: newBusiness
    });
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar empresa'
    });
  }
};

// @desc    Atualizar empresa
// @route   PUT /api/v1/businesses/:id
// @access  Private (owner ou admin)
const updateBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      phone,
      phoneSecondary,
      video,
      email,
      website,
      facebook,
      instagram,
      whatsapp,
      linkedin,
      twitter,
      youtube,
      tiktok,
      address,
      latitude,
      longitude,
      cityId,
      categoryIds,
      tagIds,
      deliveryAvailable,
      deliveryFee,
      deliveryTime,
      metaTitle,
      metaDescription,
      active,
      featured,
      plan
    } = req.body;

    const business = await Business.findByPk(id);

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Empresa não encontrada'
      });
    }

    // Verificar permissão (owner ou admin)
    if (business.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para editar esta empresa'
      });
    }

    // Admin regional só pode editar empresas da sua cidade
    if (req.managedCityId && business.cityId !== req.managedCityId) {
      return res.status(403).json({
        success: false,
        error: 'Você só pode editar empresas da sua cidade gerenciada'
      });
    }

    // Atualizar dados básicos
    const updateData = {
      description,
      phone,
      phoneSecondary: normalizeOptionalTextForUpdate(phoneSecondary),
      video: normalizeOptionalTextForUpdate(video),
      email: normalizeOptionalTextForUpdate(email),
      website: normalizeOptionalTextForUpdate(website),
      facebook,
      instagram,
      whatsapp,
      linkedin,
      twitter,
      youtube,
      tiktok,
      address,
      latitude,
      longitude,
      cityId,
      deliveryAvailable,
      deliveryFee,
      deliveryTime,
      metaTitle,
      metaDescription
    };

    // Apenas admin pode alterar esses campos
    if (req.user.role === 'admin') {
      if (active !== undefined) updateData.active = active;
      if (featured !== undefined) updateData.featured = featured;
      if (plan !== undefined) {
        updateData.plan = plan;
        if (plan === 'premium') {
          updateData.planExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }
      }
    }

    // Se o nome mudou, atualizar o slug
    if (name && name !== business.name) {
      let slug = slugify(name, {
        lower: true,
        strict: true,
        locale: 'pt'
      });

      // Verificar se novo slug já existe
      let existingBusiness = await Business.findOne({ 
        where: { 
          slug,
          id: { [Op.ne]: id }
        }
      });

      let counter = 1;
      while (existingBusiness) {
        slug = `${slugify(name, { lower: true, strict: true })}-${counter}`;
        existingBusiness = await Business.findOne({ 
          where: { 
            slug,
            id: { [Op.ne]: id }
          }
        });
        counter++;
      }

      updateData.name = name;
      updateData.slug = slug;
    }

    await business.update(updateData);

    // Atualizar categorias
    if (categoryIds) {
      const categories = await Category.findAll({
        where: { id: categoryIds }
      });
      await business.setCategories(categories);
    }

    // Atualizar tags
    if (tagIds) {
      const tags = await Tag.findAll({
        where: { id: tagIds }
      });
      await business.setTags(tags);
    }

    // Buscar empresa atualizada
    const updatedBusiness = await Business.findByPk(id, {
      include: [
        { model: Category, as: 'Categories', through: { attributes: [] } },
        { model: Tag, as: 'Tags', through: { attributes: [] } },
        { model: City, as: 'City' },
        { model: BusinessGallery, as: 'gallery' },
        { model: BusinessSchedule, as: 'schedules' },
        { model: BusinessCourse, as: 'courses' }
      ]
    });

    res.json({
      success: true,
      data: updatedBusiness
    });
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar empresa'
    });
  }
};

// @desc    Deletar empresa
// @route   DELETE /api/v1/businesses/:id
// @access  Private (owner ou admin)
const deleteBusiness = async (req, res) => {
  try {
    const { id } = req.params;

    const business = await Business.findByPk(id);

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Empresa não encontrada'
      });
    }

    // Verificar permissão
    if (business.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para deletar esta empresa'
      });
    }

    // Deletar galeria, schedules e courses (cascade)
    await BusinessGallery.destroy({ where: { businessId: id } });
    await BusinessSchedule.destroy({ where: { businessId: id } });
    await BusinessCourse.destroy({ where: { businessId: id } });

    // Deletar empresa
    await business.destroy();

    res.json({
      success: true,
      message: 'Empresa deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar empresa:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar empresa'
    });
  }
};

// @desc    Buscar empresas em destaque
// @route   GET /api/v1/businesses/featured
// @access  Public
const getFeaturedBusinesses = async (req, res) => {
  try {
    const { cityId, limit = 10 } = req.query;

    const where = { 
      active: true, 
      approved: true,
      featured: true
    };
    
    if (cityId) where.cityId = cityId;

    console.log('🔍 Buscando empresas em destaque com filtro:', where);

    const businesses = await Business.findAll({
      where,
      include: [
        { model: City, as: 'City', attributes: ['id', 'name', 'slug'] },
        { model: Category, as: 'Categories', through: { attributes: [] }, attributes: ['id', 'name', 'slug', 'icon'] }
      ],
      limit: parseInt(limit),
      order: [
        ['plan', 'DESC'],
        ['rating', 'DESC']
      ]
    });

    console.log(`✅ Encontradas ${businesses.length} empresas em destaque`);

    res.json({
      success: true,
      count: businesses.length,
      data: businesses
    });
  } catch (error) {
    console.error('Erro ao buscar empresas em destaque:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar empresas em destaque'
    });
  }
};

module.exports = {
  getAllBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  getFeaturedBusinesses
};
