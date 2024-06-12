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
    // jump first line
    if (currentLine === 1) return;
    // jump empty lines
    if (line === "") return;

    // Initial message
    buildProcessingUsersMessage(currentLine, linesNumber);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Creating User Model
    buildProcessingUsersMessage(currentLine, linesNumber, "1");

    // Splitting CSV Line, respecting commas inside quotes
    const regx = RegExp(',' + "(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))"); 
    const lineData = line.split(regx);

    if (!lineData[1]) {
      console.log(
        chalk.red(
          `No se pudo obtener el email del usuario. Línea ${currentLine}, Nombre ${lineData[2]} ${lineData[3]}`
        )
      );
      return;
    }
    const user = {
      username: validateUsername(lineData[6]) || createNewUsernameUsingEmail(lineData[1]) || await createNewUsernameUsingName(lineData[2]),
      password: await logto.generateRandomPassword64(),
      primaryEmail: lineData[1],
      name: lineData[2] + " " + lineData[3],
      profile: {
        givingName: lineData[2],
        familyName: lineData[3],
        birthdate: lineData[8],
      },
      customData: {
        schoolId: lineData[17],
        grado: lineData[7],
        acudiente: lineData[9],
        frase: lineData[12],
        aboutMe: lineData[13],
      },
    };


    // Saving User in Logto
    buildProcessingUsersMessage(currentLine, linesNumber, "2");
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // Verify if user already exists
    const userExists = await logto.searchUserByEmail(user.primaryEmail);
    let userLogto;
    if (userExists.length > 0) {
    userLogto = await logto.updateUser(user, userExists[0].id);
    } else {
      userLogto = await logto.saveUser(user);
    }
    if (!userLogto) throw new Error(`No se pudo guardar el usuario en Logto Line: ${currentLine}`);
    if(userLogto.data?.issues) {
      console.error(userLogto.data.issues);
      throw new Error(`No se pudo guardar el usuario en Logto Line: ${currentLine}`);
    }

    // Assigning Roles to User
    buildProcessingUsersMessage(currentLine, linesNumber, "4");
    await logto.asignRoleToUser(userLogto.id, 'captain');

    // Updating User ID in Original Database
    buildProcessingUsersMessage(currentLine, linesNumber, "3");
    const social_ig = lineData[6].replace("@", "");
    if(currentLine === 18) {
      console.log(user);
    }

    await upsertUser(
      {
        userid: userLogto.id,
        email: user.primaryEmail,
        telefono: lineData[5],
        nombre_autor: lineData[4],
        nombres: lineData[2],
        apellidos: lineData[3],
        grado: lineData[7],
        fecha_nacimiento: lineData[8],
        id_colegio: lineData[17],
        id_wp: 0,
        avatar_filename: lineData[18],
        nombre_acudiente: lineData[9],
        telefono_acudiente: lineData[10],
        email_acudiente: lineData[11],
      },
      {
        social_ig: social_ig,
        bio_frase: lineData[12],
        bio_acercade: lineData[13],
      },
      userLogto.id
    );
    // Success Message
    buildProcessingUsersMessage(currentLine, linesNumber, "done");
  }
);
}

function validateUsername(username) {
  let usernameTrimmed = ""+username.trim();
  usernameTrimmed = usernameTrimmed.replace("@", "").replace(".", "").replace("_", "").replace("-", "").replace(",", "");
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
    process.exit(1);
  }
}

init();
