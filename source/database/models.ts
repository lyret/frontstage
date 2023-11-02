import { DataTypes } from "sequelize";
import { defineModels, defineModel } from "./_connection";

/** The defined database models */
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
  /** Certificates */
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
  /**
   * State objects are stored as JSON blobs and accessible from all
   * internal processes
   */
  StateObjects: defineModel<{ index: string; state: Object }>(
    {
      index: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      state: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {
      timestamps: true,
    }
  ),
  /**
   * Outstanding Challenges to Lets Encrypt are stored
   * in the database while certificates are requested
   */
  LetsEncryptChallenges: defineModel<{ index: string; key: string }>(
    {
      index: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {}
  ),
});
