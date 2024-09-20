const { Client, GatewayIntentBits,Partials, ActivityType, REST, Routes, EmbedBuilder } = require('discord.js');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

const commands = [
  {
    name: 'help',
    description: 'Shows help information for bot commands',
  }
];

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', () => {
  console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Available Commands')
      .setDescription('Here are the commands you can use:')
      .addFields(
        { name: '!run <language(cpp/python)> <code>', value: 'Runs code in the specified language (e.g., `!run cpp` <code>`).', inline: false },
        { name: '!compile <language> <code>', value: 'Compiles code in the specified language (e.g., `!compile cpp` <code>`).', inline: false },
        { name: '/help', value: 'Displays this help message.', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Bot Help', iconURL: 'https://i.ibb.co/hCSsQK6/437e8c95.webp' });

    await interaction.reply({ embeds: [helpEmbed] });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.startsWith('!run') || message.content.startsWith('!compile')) {
    const args = message.content.slice(message.content.startsWith('!run') ? 5 : 8).trim().split('\n');
    const command = message.content.startsWith('!run') ? 'run' : 'compile';
    const language = args.shift().trim();

    if (!language) {
      return message.channel.send('❗ Please specify the language with `!run <language>` or `!compile <language>`. For example: `!run cpp`.');
    }

    // Handle different code formats and remove backticks
    let code = args.join('\n').trim();
    if (code.startsWith('```') && code.endsWith('```')) {
      code = code.slice(3, -3).trim();
    }

    if (language === 'cpp') {
      handleCppCommand(command, code, message);
    } else if (language === 'python') {
      handlePythonCommand(command, code, message);
    } else if (language === 'java') {
      handleJavaCommand(command, code, message);
    } else {
      message.channel.send('❗ Unsupported language. Supported languages are `cpp`, `python`, and `java`.');
    }
  }
});

function handleCppCommand(command, code, message) {
  const filePath = path.join(__dirname, 'temp.cpp');
  const execFilePath = path.join(__dirname, 'temp');

  message.channel.send('⏳ Compiling your C++ code...').then(sentMessage => {
    fs.writeFile(filePath, code, err => {
      if (err) return sentMessage.edit('❌ Error writing C++ code file.');

      exec(`g++ "${filePath}" -o "${execFilePath}"`, (err, stdout, stderr) => {
        if (err) return sentMessage.edit(`❌ Error compiling C++ code: ${stderr}`);

        if (needsInput(code)) {
          requestUserInput(message, sentMessage, execFilePath, 'C++');
        } else {
          exec(`"${execFilePath}"`, (err, stdout, stderr) => {
            if (err) return sentMessage.edit(`❌ Error running C++ executable: ${stderr}`);
            sentMessage.edit(`✅ C++ Output:\n\`\`\`\n${stdout}\n\`\`\``);
          });
        }
      });
    });
  });
}

function handlePythonCommand(command, code, message) {
  const filePath = path.join(__dirname, 'temp.py');

  message.channel.send('⏳ Running your Python code...').then(sentMessage => {
    fs.writeFile(filePath, code, err => {
      if (err) return sentMessage.edit('❌ Error writing Python code file.');

      if (needsInput(code)) {
        requestUserInput(message, sentMessage, `python "${filePath}"`, 'Python');
      } else {
        exec(`python "${filePath}"`, (err, stdout, stderr) => {
          if (err) return sentMessage.edit(`❌ Error running Python code: ${stderr}`);
          sentMessage.edit(`✅ Python Output:\n\`\`\`\n${stdout}\n\`\`\``);
        });
      }
    });
  });
}

function handleJavaCommand(command, code, message) {
  const filePath = path.join(__dirname, 'Main.java');
  const execFilePath = path.join(__dirname, 'Main');

  message.channel.send('⏳ Compiling your Java code...').then(sentMessage => {
    fs.writeFile(filePath, code, err => {
      if (err) return sentMessage.edit('❌ Error writing Java code file.');

      exec(`javac "${filePath}"`, (err, stdout, stderr) => {
        if (err) return sentMessage.edit(`❌ Error compiling Java code: ${stderr}`);

        if (needsInput(code)) {
          requestUserInput(message, sentMessage, `java -cp "${__dirname}" Main`, 'Java');
        } else {
          exec(`java -cp "${__dirname}" Main`, (err, stdout, stderr) => {
            if (err) return sentMessage.edit(`❌ Error running Java code: ${stderr}`);
            sentMessage.edit(`✅ Java Output:\n\`\`\`\n${stdout}\n\`\`\``);
          });
        }
      });
    });
  });
}

function needsInput(code) {
  // This function checks if the code likely requires input
  const inputKeywords = ['input', 'scanf', 'cin', 'readLine'];
  return inputKeywords.some(keyword => code.includes(keyword));
}

function requestUserInput(message, sentMessage, execCommand, language) {
  message.channel.send(`📝 Your ${language} code requires input. Please provide the input:If multiple then separate by space or nextline`).then(() => {
    const filter = response => response.author.id === message.author.id;
    message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
      .then(collected => {
        const userInput = collected.first().content;
        exec(`echo "${userInput}" | ${execCommand}`, (err, stdout, stderr) => {
          if (err) return sentMessage.edit(`❌ Error running ${language} code: ${stderr}`);
          sentMessage.edit(`✅ ${language} Output:\n\`\`\`\n${stdout}\n\`\`\``);
        });
      })
      .catch(() => sentMessage.edit('⌛ No input provided. Execution aborted.'));
  });
}

client.on('ready',(c) =>{
  console.log(`INTENT SUCCESSFULL.`);
  client.user.setActivity({
    name: 'your CODE',
    type: ActivityType.Watching
  });
});

client.login(process.env.TOKEN);
