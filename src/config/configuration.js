import { readFileSync } from "fs";
import * as yaml from "js-yaml";
import { resolve } from "path";

const YAML_CONFIG_FILENAME = "config.yaml";

export default function configuration() {
  return Configuration.getInstance();
}

export class Configuration {
  static instance;
  config;

  constructor() {
    this.config = yaml.load(
      readFileSync(resolve("", YAML_CONFIG_FILENAME), "utf8")
    );
  }

  static getInstance() {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }

  /**
   * Get a configuration value by key
   * @param key
   */
  get(key) {
    return this.config[key];
  }
}
