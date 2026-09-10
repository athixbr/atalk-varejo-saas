import CrmClient from "../../models/CrmClient";
import User from "../../models/User";
import CrmBusinessType from "../../models/CrmBusinessType";
import CrmTaxRegime from "../../models/CrmTaxRegime";
import AppError from "../../errors/AppError";

const ShowService = async (
  id: string | number,
  companyId: number
): Promise<CrmClient> => {
  const client = await CrmClient.findOne({
    where: { id, companyId },
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: CrmBusinessType, as: "businessType", attributes: ["id", "name"] },
      { model: CrmTaxRegime, as: "taxRegime", attributes: ["id", "name"] }
    ]
  });

  if (!client) {
    throw new AppError("ERR_NO_CLIENT_FOUND", 404);
  }

  return client;
};

export default ShowService;
