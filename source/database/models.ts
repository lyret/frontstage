import { DataTypes } from "sequelize";
import { defineModels, defineModel } from "./_connection";

/** The defined database Models */
export const Models = defineModels({
  /** Stored Certificates */
  certificates: defineModel<Certificates.StoredCertificate>(
    {
      hostname: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      renewalMethod: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      renewWithin: {
        type: DataTypes.NUMBER,
        allowNull: false,
      },
      expiresOn: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      certificate: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      privateKey: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      paranoid: true,
    }
  ),
});
