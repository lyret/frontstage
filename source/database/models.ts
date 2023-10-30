import { DataTypes } from "sequelize";
import { defineModels, defineModel } from "./_connection";

/** The defined database Models */
export const Models = defineModels({
  /** Redirections */
  Redirections: defineModel<Routes.Redirection>(
    {
      hostname: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      label: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      target: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      timestamps: true,
    }
  ),
  /** Internal Routes */
  InternalRoutes: defineModel<Routes.InternalRoute>(
    {
      hostname: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      label: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      port: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      secure: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
    },
    {
      timestamps: true,
    }
  ),
  /** Stored Certificates */
  Certificates: defineModel<Certificates.StoredCertificate>(
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
    }
  ),
});
