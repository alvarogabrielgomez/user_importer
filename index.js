import chalk from "chalk";
import LogtoService from "./src/services/logto.js";
import dotenv from "dotenv";
import fs from "fs";
import readline from "readline";
import { UserRepository } from "./src/repositories/user.repo.js";
dotenv.config();
import { parse } from 'csv-parse';

const logto = new LogtoService();
const userRepository = new UserRepository();
const width = process.stdout.columns;

async function init() {
  console.clear();
  console.log(chalk.white("Iniciando..."));
  console.log(chalk.white("=".repeat(width)));
  console.log();
  console.log(chalk.yellow("Conectando a base de datos 500H..."));
  await userRepository.init();
  console.log(chalk.yellow("Obteniendo Token..."));
  await logto.getToken();
  console.log(chalk.white("Conectando a Logto usando el Access Token..."));
  const logs = await logto.testToken();
  if (logs) {
    console.log(chalk.green("Token válido"));
    console.log(chalk.yellow("Obteniendo roles disponibles..."));
    await logto.fetchAllRoles();
  } else {
    console.log(chalk.red("Token inválido"));
    process.exit(1);
  }
  console.log(chalk.white("=".repeat(width)));
  console.log();
  console.log(chalk.white("Obteniendo usuarios desde origen..."));

  await processCaptains();
}

async function processCaptains() {
  await readLineByLineCSV("./capitanes.csv",
  async (line, currentLine, linesNumber) => {
    // if(currentLine < 140) return;
    // jump first line
    // if (currentLine === 1) return;
    // jump empty lines
    if (line === "") return;
    line = line.replaceAll("NULL", "")

    // Initial message
    buildProcessingUsersMessage(currentLine, linesNumber);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Creating User Model
    buildProcessingUsersMessage(currentLine, linesNumber, "1");

    // Splitting CSV Line, respecting commas inside quotes
    const regx = RegExp(',' + "(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))"); 
    const lineDataRaw = line.split(regx);
    const social_ig = makeSocialIG(lineDataRaw[5])
    const username = await makeLogtoUsername(social_ig, `${lineDataRaw[1]} ${lineDataRaw[2]}`);
    let userData = {
      username: username,
      email: lineDataRaw[0].replaceAll("\"", "").replaceAll(" ", "").replaceAll("\n", "").replaceAll("\'", ""),
      telefono: lineDataRaw[4],
      nombre_autor: lineDataRaw[5].replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").trim(),
      nombres: lineDataRaw[1].replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").trim(),
      apellidos: lineDataRaw[2].replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").trim(),
      grado: lineDataRaw[6],
      fecha_nacimiento: lineDataRaw[7].replaceAll("\"", "").replaceAll("\'", ""),
      id_colegio: lineDataRaw[12].replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").replaceAll(" ", "").trim(),
      id_wp: lineDataRaw[14].replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").replaceAll(" ", "").trim(),
      avatar_filename: lineDataRaw[13],
      nombre_acudiente: lineDataRaw[8].replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").trim(),
      email_acudiente: lineDataRaw[9].replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").trim(),
      telefono_acudiente: "",
    }
    const userExtras = {
      social_ig: lineDataRaw[5].replace("@", "").replaceAll("\"", "").replaceAll(" ", "").replaceAll("\n", "").replaceAll("\'", ""),
      bio_frase: lineDataRaw[10],
      bio_acercade: lineDataRaw[11],
    }

    if(userData.fecha_nacimiento === "NULL" || userData.fecha_nacimiento === "") {
      userData.fecha_nacimiento = "0000-00-00";
    }
    if(userData.id_colegio === "NULL" || userData.id_colegio === "") {
      throw new Error(`No se pudo obtener el ID del colegio. Línea ${currentLine}, Nombre ${userData.nombres} ${userData.apellidos}`);
    }
    if (!userData.email) {
      console.log(
        chalk.red(
          `No se pudo obtener el email del usuario. Línea ${currentLine}, Nombre ${userData.nombres} ${userData.apellidos}`
        )
      );
      return;
    }
    const newLogtoUser = {
      username: userData.username,
      password: await logto.generateRandomPassword64(),
      primaryEmail: userData.email,
      name: `${userData.nombres} ${userData.apellidos}`,
      profile: {
        givingName: userData.nombres,
        familyName: userData.apellidos,
      },
      customData: {
        schoolId: userData.id_colegio,
        grado: userData.grado,
        frase: userExtras.bio_frase,
        aboutMe: userExtras.bio_acercade,
      },
    };


    // Saving User in Logto
    buildProcessingUsersMessage(currentLine, linesNumber, "2");
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // Verify if user already exists
    const verifyLogtoUserExists = await logto.searchUserByEmail(newLogtoUser.primaryEmail);
    let savedLogtoUser;
    if (verifyLogtoUserExists.length > 0) {
    savedLogtoUser = await logto.updateUser(newLogtoUser, verifyLogtoUserExists[0].id);
    } else {
      savedLogtoUser = await logto.saveUser(newLogtoUser);
    }
    if (!savedLogtoUser) throw new Error(`No se pudo guardar el usuario en Logto Line: ${currentLine}`);
    if(savedLogtoUser.data?.issues) {
      console.error(savedLogtoUser.data.issues);
      throw new Error(`No se pudo guardar el usuario en Logto Line: ${currentLine}`);
    }

    // Assigning Roles to User
    buildProcessingUsersMessage(currentLine, linesNumber, "4");
    if(savedLogtoUser.id == null || savedLogtoUser.id == "") {
      throw new Error(`No se pudo obtener el ID del usuario. Línea ${currentLine}, Nombre ${userData.nombres} ${userData.apellidos}`);
    }
    await logto.asignRoleToUser(savedLogtoUser.id, 'captain');

    // Updating User ID in Original Database
    buildProcessingUsersMessage(currentLine, linesNumber, "3");
    // if(currentLine === 18) {
    //   console.log(user);
    // }

    await upsertUser(
      userData, userExtras,
      savedLogtoUser.id
    );
    // Success Message
    buildProcessingUsersMessage(currentLine, linesNumber, "done");
  }
);
}

function makeSocialIG(rawString) {
  const step1 = rawString.replaceAll("\"", "").replaceAll("\n", "").replaceAll("\'", "").replaceAll("@", "").trim();
  const validUsername = validateUsername(step1);
  return validUsername || null;
}

async function makeLogtoUsername(rawString, nameOfUser) {
  const step1 = rawString?.replaceAll("\"", "")?.replaceAll("\n", "")?.replaceAll("\'", "")?.replaceAll("@", "")?.trim();
  const validUsername = validateUsername(step1);
  return validUsername || await createNewUsernameUsingName(nameOfUser);
}

function validateUsername(username) {
  let usernameTrimmed = username?.trim();
  if(!usernameTrimmed) return null;
  usernameTrimmed = usernameTrimmed.replaceAll("@", "").replaceAll(".", "").replaceAll("-", "").replaceAll(",", "").replaceAll("NULL", "");
  // Username must be at least 3 characters long
  // Username must not contain spaces, commas, or quotes
  // Username must not contain special characters like @, #, $, %, underscore, etc.
  const regx = /^[A-Z_a-z]\w*$/;
  const isValid = regx.test(usernameTrimmed);
  if (isValid) {
    return usernameTrimmed;
  }
  return null;
}
function createNewUsernameUsingEmail(email) {
  const [username] = email.split("@");
  const newUsernameIsValid = validateUsername(username);
  return newUsernameIsValid;
}

async function createNewUsernameUsingName(nameOfUser) {
  const random15Chars = await logto.generateRandomAZ09String(8);
  const newUsername = nameOfUser.trim().replace(" ", "").replace(/[^a-zA-Z0-9]/g, "")+random15Chars;
  const newUsernameIsValid = validateUsername(newUsername);
  return newUsernameIsValid || await logto.generateRandomAZ09String(15);
}

async function readLineByLineCSV(file, callback) {
  const fileStream = fs.createReadStream(file);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const linesNumber = fs
    .readFileSync(file)
    .toString()
    .split("\n").length;
  let currentLine = 1;

  for await (const line of rl) {
    // Wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // const [name, email, password] = line.split(',');
    await callback(line, currentLine, linesNumber);
    currentLine++;
  }
  console.log();
  console.log(chalk.green("Listo."));
}

function buildProcessingUsersMessage(
  currentLine,
  linesNumber,
  currentTask
) {
  process.stdout.clearLine(0, () => {
    process.stdout.cursorTo(0);
  });
  switch (currentTask) {
    case "1":
      process.stdout.write(
        `Procesando usuario ${currentLine} de ${linesNumber} -> Procesando formatación.`
      );
      break;
    case "2":
      process.stdout.write(
        `Procesando usuario ${currentLine} de ${linesNumber} -> Guardando usuario en Logto.`
      );
      break;
    case "3":
      process.stdout.write(
        `Procesando usuario ${currentLine} de ${linesNumber} -> Actualizando nuevo ID en base de datos original.`
      );
      break;
    case "4":
      process.stdout.write(
        `Procesando usuario ${currentLine} de ${linesNumber} -> Asignando Roles al usuario.`
      );
      break;
    case "done":
      process.stdout.write(
        `Procesando usuario ${currentLine} de ${linesNumber} -> Completado.`
      );
      break;
    default:
      process.stdout.write(
        `Procesando usuario ${currentLine} de ${linesNumber}`
      );
      break;
  }
}

async function upsertUser(user, userExtras, userId) {
  try {
    const aylmao = await userRepository.upsertUser(user, userExtras, userId);
    return aylmao;
  } catch (error) {
    console.error(
      chalk.red(
        `Error al actualizar usuario en base de datos de 500H. \n\n${error}`
      )
    );

        console.error(
      chalk.red(
        `${user.toString()} \n\n ${userExtras.toString()} \n\n ${userId.toString()}`
      )
    );
    process.exit(1);
  }
}

init();
