import { DataSource } from "typeorm";
import DataSourceManager from "../database/database.js";
export class UserRepository {
  dataSource;
  ready = false;

  async init() {
    const dsManager = await DataSourceManager.getInstance();
    this.dataSource = dsManager.getDataSource("500historias_cms_cronicas");
    this.ready = true;
  }

  async retryOperationUntilIsReady(operation) {
    if (!this.ready) {
      console.log("Datasource not ready, retrying in 1 second...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.retryOperationUntilIsReady(operation);
    }
    return operation();
  }

  async upsertUser(user, userExtras, userId) {
    if (!userId) {
      throw new Error("userId is required", userId, user);
    }
    return this.retryOperationUntilIsReady(
    async () => {
      await this.dataSource.query(
        "DELETE FROM usuarios_master WHERE userid = ?",
        [userId]
      );

      await this.dataSource.query(
        "DELETE FROM usuarios_extras WHERE userid = ?",
        [userId]
      );

      const savedUserDb = await this.dataSource.query(
        "INSERT INTO usuarios_master (userid, email, telefono, nombre_autor, nombres, apellidos, grado, fecha_nacimiento, id_colegio, id_wp, avatar_filename, nombre_acudiente, telefono_acudiente, email_acudiente) \
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            userId,
            user.email,
            user.telefono,
            user.nombre_autor,
            user.nombres,
            user.apellidos,
            user.grado,
            user.fecha_nacimiento,
            user.id_colegio,
            user.id_wp,
            user.avatar_filename,
            user.nombre_acudiente,
            user.telefono_acudiente,
            user.email_acudiente,
          ]
        );
        
        const savedUserExtras = await this.dataSource.query(
          "INSERT INTO usuarios_extras (userid, social_ig, bio_frase, bio_acercade) \
          VALUES (?, ?, ?, ?)",
          [
            userId,
            userExtras.social_ig,
            userExtras.bio_frase,
            userExtras.bio_acercade,
          ]
        );
        return { savedUserDb, savedUserExtras };
      });
  }

  async findAll(id) {
    if (!this.ready) {
      throw new Error("Datasource not ready");
    }
    return this.dataSource.query("SELECT * FROM usuarios_master");
  }

  async findUserExtras(id) {
    if (!this.ready) {
      throw new Error("Datasource not ready");
    }
    return this.dataSource.query(
      "SELECT * FROM usuarios_extras WHERE id = $1",
      [id]
    );
  }
}
