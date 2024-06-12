import configuration from "../config/configuration.js";
import { DataSource } from "typeorm";

function getDatabasesIds() {
  const configService = configuration();
  const databases = configService.get("databases");
  const keys = Object.keys(databases);
  return keys;
}

export async function getDatabaseConnection(
  databaseId
) {
  const configService = configuration();
  const databases = configService.get("databases");
  const database = databases[databaseId];
  const dataSource = await new DataSource({
    type: database.type,
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    charset: database.charset,
    synchronize: false,
  }).initialize();

  console.log(`Database ${databaseId} connected`);
  return dataSource;
}

async function configureTypeOrmInstances() {
  try {
    const databaseIds = getDatabasesIds();
    const datasourcesPromises = databaseIds.map(
      (databaseId) => getDatabaseConnection(databaseId)
    );
    const response = Promise.all(datasourcesPromises);
    return response;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

export class DataSourceManager {
   static instance;
   datasources;

  constructor() {
    this.datasources = [];
  }

  static async getInstance() {
    if (!DataSourceManager.instance) {
      DataSourceManager.instance = new DataSourceManager();
      DataSourceManager.instance.datasources =
        await configureTypeOrmInstances();
    }
    return DataSourceManager.instance;
  }

  getDataSource(databaseId) {
    const dataSource = this.datasources.find(
      (dataSource) => dataSource.options.database === databaseId
    );
    if (!dataSource) {
      throw new Error(`DataSource ${databaseId} not found`);
    }
    return dataSource;
  }
}

export default DataSourceManager;
