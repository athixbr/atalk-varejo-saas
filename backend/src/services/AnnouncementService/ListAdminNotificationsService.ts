import Announcement from "../../models/Announcement";
import User from "../../models/User";

interface Request {
  companyId: number;
}

interface Response {
  records: Announcement[];
  count: number;
}

const ListAdminNotificationsService = async ({
  companyId
}: Request): Promise<Response> => {
  const { count, rows: records } = await Announcement.findAndCountAll({
    where: {
      companyId,
      tipo: "admin_notification"
    },
    include: [
      {
        model: User,
        as: "createdByUser",
        attributes: ["id", "name"]
      }
    ],
    order: [["createdAt", "DESC"]]
  });

  return { records, count };
};

export default ListAdminNotificationsService;
