const { Command, util } = require('klasa');
const { MessageEmbed, WebhookClient } = require('discord.js');

// Use channel for bots that are NOT sharded otherwise use a webhook
const translationChannel = '490707295919931394';
const webhookID = '';
const webhookToken = '';
// How long to awaitMessages in Milliseconds to get the translation
const time = 120000;
const key = 'key';

const exampleTranslationEmbed = new MessageEmbed()
  .setColor('RANDOM')
  .setDescription(
    [
      'ONLY TRANSLATE GREEN COLOR WORDS THE REST STAY THE SAME.',
      '',
      '**Example**',
      '',
      util.codeBlock(
        'js',
        "`${key} has been ${enabled ? 'enabled' : 'disabled'}.`" + ' '
      ),
      '',
      'The above should be translated as the following:',
      '`${key} ha sido ${enabled ? "habilitado" : "deshabilitado"}.`',
      '',
      'ONLY TRANSLATE GREEN COLOR WORDS THE REST STAY THE SAME',
    ].join('\n')
  )
  .setFooter('Colors will only be seen on PC/Mac version of discord.');

module.exports = class extends Command {
  constructor(...args) {
    super(...args, {
      aliases: ['t'],
      description: (language) => language.get('COMMAND_TRANSLATE_DESCRIPTION'),
      usage: '<arabic>',
      usageDelim: ' ',
    });
  }

  async run(message, [languageName]) {
    const { language } = message.language;
    const keys = Object.keys(language);

    // Show example translation
    await message.channel.send(exampleTranslationEmbed);

    for (const key of keys) {
      // TODO: skip if the key is already translated in the selected language with languageName.
      const isAlreadyTranslated = false;
      if (isAlreadyTranslated) continue;
      // Get the value of the key to be translated
      let value = language[key];
      // Check if this value is a function or a string
      const isFunc = typeof value === 'function';
      // Convert it to a string if necessary
      if (isFunc) value = value.toString();
      // Find the index to cut off where the => starts and add 3 to remove the "=> "
      const funcIndex = isFunc ? value.indexOf('=>') + 3 : 0;
      // Cut out the parameters and make the first character shown to user be the first character in the string to be translated.
      const stringToTranslate = isFunc ? value.substring(funcIndex) : value;
      // Send the message to show the user what to translate
      await message.send(
        new MessageEmbed()
          .setColor('RANDOM')
          .setFooter(
            'Only the GREEN color text should be translated the rest should be left the same.'
          )
          .setDescription(util.codeBlock('js', stringToTranslate + ' '))
          .setFooter(`Listening for translation for ${time / 1000} seconds`)
      );
      // Ask the user for the translation
      const translation = await message.channel.awaitMessages(
        (m) => m.author.id === message.author.id,
        { max: 1, time, errors: ['time'] }
      );

      const fullValue = `${key}: ${value.substring(0, funcIndex)} ${
        translation.first().content
      }`;
      // Create the message that will be sent to the devs/mods of the bot
      const messageToSend = `ar-Ar Translated By ${message.author.tag} ID: ${
        message.author.id
      }\n\n${util.codeBlock('js', fullValue + ' ')}`;

      const test = `{
        languageKey: 'ar-Ar',
        authorTag: ${message.author.tag},
        authorID: ${message.author.id},
        key: ${key},
        translation: ${fullValue},
      }`;

      // SIMPLE SMALL BOTS: Send the translation to be reviewed to the channel
      if (translationChannel) {
        const channel = this.client.channels.get(translationChannel);
        await channel.send(messageToSend);
      }
      // MORE ADVANCED: If the bot is sharded you can use a webhook to send instead of a channel
      else {
        const webhook = new WebhookClient(webhookID, webhookToken);
        await webhook.send({ embeds });
      }
    }
  }

  async accept(message, [messageID]) {
    const translationMessage =
      message.channel.messages.get(messageID) ||
      (await message.channel.messages.fetch(messageID).catch(() => null));
    if (!translationMessage) return null;

    // Convert the translationMessage into a proper JSON
    const json = JSON.parse(translationMessage.content);

    // Check if the language already has a document and update it with this key and value OR create the language file if it doesnt exist with the key and value provided.
    const languageFile = await this.client.providers.default.get(
      'translations',
      json.languageKey
    );
    await this.client.providers.default[languageFile ? 'update' : 'create'](
      'translations',
      json.languageKey,
      { [json.key]: json.translation }
    );

    // Reloads all languages to be safe and automatically update the live languages
    await this.client.commands.get('reload').run(message, ['languages']);

    // Delete the translation message and the command to keep the channel clean
    await translationMessage.delete();
    await message.delete();

    const translator =
      this.client.users.get(json.authorID) ||
      (await this.client.users.fetch(json.authorID).catch(() => null));
    if (!translator) return null;

    return translator
      .send(
        `The translation you sent has been added to the bot. THANK YOU!\n\n${
          json.translation
        }`
      )
      .catch(() => null);
  }

  async init() {
    // If there is no translation table then create it.
    const translationTable = this.client.providers.default.get('translations');
    if (!translationTable)
      this.client.providers.default.createTable('translations');
  }
};