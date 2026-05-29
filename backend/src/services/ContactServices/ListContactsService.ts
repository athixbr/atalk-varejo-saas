// @ts-ignore
import { Sequelize, Op, Filterable } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ContactTag from "../../models/ContactTag";
import User from "../../models/User";

import { intersection } from "lodash";
import Tag from "../../models/Tag";
import removeAccents from "remove-accents";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  tagsIds?: number[];
  isGroup?: string;
  channel?: string;
  active?: string;
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  tagsIds,
  isGroup,
  channel,
  active
}: Request): Promise<Response> => {
  const rawSearch = searchParam.trim();
  const sanitizedSearchParam = removeAccents(rawSearch.toLocaleLowerCase());

  let whereCondition: Filterable["where"] = {
    [Op.or]: [
      // busca por nome sem acento (cobre emoji pois removeAccents não os remove)
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Contact.name")),
          "LIKE",
          `%${sanitizedSearchParam}%`
        )
      },
      // busca por nome original (cobre emoji que removeAccents poderia suprimir)
      {
        name: { [Op.iLike]: `%${rawSearch}%` }
      },
      { number: { [Op.like]: `%${rawSearch}%` } },
      { email: { [Op.iLike]: `%${rawSearch}%` } }
    ]
  };

  whereCondition = {
    ...whereCondition,
    companyId
  };

  if (Array.isArray(tagsIds) && tagsIds.length > 0) {
    const contactTagFilter: any[] | null = [];
    const contactTags = await ContactTag.findAll({
      where: { tagId: { [Op.in]: tagsIds } }
    });
    if (contactTags) {
      contactTagFilter.push(contactTags.map(t => t.contactId));
    }

    const contactTagsIntersection: number[] = intersection(...contactTagFilter);

    whereCondition = {
      ...whereCondition,
      id: {
        [Op.in]: contactTagsIntersection
      }
    };
  }

  if (isGroup === "false") {
    whereCondition = {
      ...whereCondition,
      isGroup: false
    };
  }

  if (channel && channel !== "") {
    whereCondition = {
      ...whereCondition,
      channel
    };
  }

  if (active !== undefined && active !== "") {
    whereCondition = {
      ...whereCondition,
      active: active === "true"
    };
  }

  // Oculta contatos LID (identificadores internos do WhatsApp sem número real).
  // Números válidos BR têm no máximo 13 dígitos; LIDs têm 14-16.
  whereCondition = {
    ...whereCondition,
    [Op.or]: [
      { isGroup: true },
      Sequelize.where(
        Sequelize.fn("length", Sequelize.col("Contact.number")),
        { [Op.lte]: 13 }
      )
    ]
  };

  const limit = 100;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    limit,
    include: [
      {
        model: Ticket,
        as: "tickets",
        attributes: ["id", "status", "createdAt", "updatedAt", "userId"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name"]
          }
        ]
      },
      {
        model: Tag,
        as: "tags"
      }
    ],
    offset,
    order: [["name", "ASC"]]
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
