// @ts-ignore
import { Op, Sequelize } from "sequelize";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";

interface Params {
  companyId: string | number;
  searchParam?: string;
}

const SimpleListService = async ({
  companyId,
  searchParam
}: Params): Promise<User[]> => {
  const whereCondition: any = { companyId };

  if (searchParam) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("User.name")),
        "LIKE",
        `%${searchParam.toLowerCase()}%`
      ),
      { email: { [Op.iLike]: `%${searchParam}%` } }
    ];
  }

  const users = await User.findAll({
    where: whereCondition,
    attributes: ["name", "id", "email"],
    include: [
      { model: Queue, as: 'queues' }
    ],
    order: [["id", "ASC"]]
  });

  if (!users) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  return users;
};

export default SimpleListService;
