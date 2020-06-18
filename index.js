const dotenv = require('dotenv');
const path = require('path');
const restify = require('restify');

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { BotFrameworkAdapter, UserState, MemoryStorage, ConversationState, BotTelemetryClient, NullTelemetryClient, TelemetryLoggerMiddleware, TranscriptLoggerMiddleware } = require('botbuilder');

const { ApplicationInsightsTelemetryClient, ApplicationInsightsWebserverMiddleware} = require('botbuilder-applicationinsights');
// This bot's main dialog.
const { TescoBot } = require('./bot');

// Import required bot configuration.
const ENV_FILE = path.join(__dirname, '.env');
dotenv.config({ path: ENV_FILE });

function getTelemetryClient(env) {
    if(env.BotApplicationInstrumentKey) {
        const instrumentationkey = env.BotApplicationInstrumentKey;
        return new ApplicationInsightsTelemetryClient(instrumentationkey);
    }
    return new NullTelemetryClient();
}

const telemetryClient = getTelemetryClient(process.env);
// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about how bots work.
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    channelService: process.env.ChannelService,
    openIdMetadata: process.env.BotOpenIdMetadata,
    telemetryClient
});



// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    console.error(`\n [onTurnError]: ${ error }`);
    // Send a message to the user
    await context.sendActivity(`Oops. Something went wrongg!`);
    telemetryClient.trackException({ exception: error });
};

adapter.use(new TelemetryLoggerMiddleware(telemetryClient, true));

// A bot requires a state store to persist the dialog and user state between messages.
let conversationState, userState;

// For local development, in-memory storage is used.
// CAUTION: The Memory Storage used here is for local bot debugging only. When the bot
// is restarted, anything stored in memory will be gone.
const memoryStorage = new MemoryStorage();
conversationState = new ConversationState(memoryStorage);
userState = new UserState(memoryStorage);

const luisPredictionOptions = {
    telemetryClient: telemetryClient,
    logPersonalInformation: true
}

// Create the main dialog.
let bot;
try {
    bot = new TescoBot(conversationState, userState, luisPredictionOptions, telemetryClient);

} catch (err) {
    console.error(`[botInitializationError]: ${ err }`);
    process.exit();
}

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.use(ApplicationInsightsWebserverMiddleware);

server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${ server.name } listening to ${ server.url }`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    console.log(`\nTo talk to your bot, open the emulator select "Open Bot"`);
});

// Listen for incoming requests.
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        // Route to main dialog.
        await bot.run(context);
    });
});
