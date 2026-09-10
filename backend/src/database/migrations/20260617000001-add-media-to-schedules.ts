import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Schedules", "mediaUrl", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("Schedules", "mediaType", {
      type: DataTypes.STRING(50),
      allowNull: true,
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Schedules", "mediaUrl");
    await queryInterface.removeColumn("Schedules", "mediaType");
  },
};
