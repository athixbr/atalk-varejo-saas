import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "isMerged", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    await queryInterface.addColumn("Tickets", "mergedIntoTicketId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Tickets", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "mergedIntoTicketId");
    await queryInterface.removeColumn("Tickets", "isMerged");
  }
};
