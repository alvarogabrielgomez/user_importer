import chalk from "chalk";
import * as crypto from "crypto";

export default class LogtoService {
  appId;
  appSecret;
  scopes;
  resource;
  accessToken;
  refreshToken;
  endpoint;
  rolesAvailables;
  constructor() {
    this.appId = process.env.M2M_IDENTITY_PROVIDER_APP_ID;
    this.appSecret = process.env.M2M_IDENTITY_PROVIDER_APP_SECRET;
    this.scopes = process.env.M2M_IDENTITY_PROVIDER_API_SCOPE;
    this.resource = process.env.M2M_IDENTITY_PROVIDER_API_RESOURCE;
    this.endpoint = process.env.M2M_IDENTITY_PROVIDER_ENDPOINT;
    this.accessToken = null;
    this.refreshToken = null;
    this.rolesAvailables = [];
  }

  searchUserByEmail(email) {
    const url = `${this.endpoint}/api/users`;
    const parameters = new URLSearchParams([
      ["search.primaryEmail", `%${email}%`],
    ]);

    return fetch(`${url}?${parameters.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        return data;
      })
      .catch((err) => {
        console.error(err);
        console.log(chalk.red(err));
        // close the server
        process.exit(1);
      });
  }

  saveUser(user) {
    const body = JSON.stringify(user);
    return fetch(`${this.endpoint}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body,
    })
      .then((res) => res.json())
      .then((data) => {
        return data;
      })
      .catch((err) => {
        console.error(err);
        console.log(chalk.red(err));
        // close the server
        process.exit(1);
      });
  }

  updateUser(user, userId) {
    const body = JSON.stringify(user);
    return fetch(`${this.endpoint}/api/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body,
    })
      .then((res) => res.json())
      .then((data) => {
        return data;
      })
      .catch((err) => {
        console.error(err);
        console.log(chalk.red(err));
        // close the server
        process.exit(1);
      });
  }

  fetchAllRoles() {
    return fetch(`${this.endpoint}/api/roles`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        this.rolesAvailables = data.map((role) => {
          return {
            id: role.id,
            name: role.name,
          };
        });
        return data;
      })
      .catch((err) => {
        console.error(err);
        console.log(chalk.red(err));
        // close the server
        process.exit(1);
      });
  }

  asignRoleToUser(userId, roleName) {
    if (!userId) {
      throw new Error("userId is required");
    } 
    // Verify if the role exists in the rolesAvailables
    const role = this.rolesAvailables.find((role) => role.name === roleName);
    if (!role) {
      console.error(`Role ${roleName} not found`);
      throw new Error(`Role ${roleName} not found`);
    }
    const body = JSON.stringify({
      "roleIds": [
        role.id
      ]
    });

    return fetch(`${this.endpoint}/api/users/${userId}/roles`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body,
    })
      .then((data) => {
        return data;
      })
      .catch((err) => {
        console.error(err);
        console.log(chalk.red(err));
        // close the server
        process.exit(1);
      });
  }

  generateRandomPassword64() {
    // Generate a random password using crypto
    return new Promise((resolve, reject) => {
      crypto.randomBytes(32, (err, buffer) => {
        if (err) reject(err);
        resolve(buffer.toString("base64"));
      });
    });
  }

  generateRandomAZ09String(length) {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(length, (err, buffer) => {
        if (err) reject(err);
        const randomString = buffer.toString("base64").slice(0, length);
        // Remove all special characters
        const cleanString = randomString.replace(/[^a-zA-Z0-9]/g, "");
        resolve(cleanString);
      });
    });
  }

  getToken() {
    return fetch(`${this.endpoint}/oidc/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${this.appId}:${this.appSecret}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        resource: this.resource,
        scope: this.scopes,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data["access_token"] === undefined)
          throw new Error("No se pudo obtener el token");
        this.accessToken = data.access_token;
        if (data.refresh_token) this.refreshToken = data.refresh_token;
        return data;
      })
      .catch((err) => {
        console.error(err);
        console.log(chalk.red(err));
        // close the server
        process.exit(1);
      });
  }

  getLogs() {
    return fetch(`${this.endpoint}/api/logs`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        return data;
      })
      .catch((err) => {
        console.error(err);
        console.log(chalk.red(err));
        // close the server
        process.exit(1);
      });
  }

  testToken() {
    return this.getLogs();
  }
}
