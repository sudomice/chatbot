const { ActivityHandler, ActivityTypes } = require('botbuilder');
const { LuisRecognizer, LuisApplication, luisPredictionOption, QnAMaker  } = require('botbuilder-ai');
const { DialogSet, DialogTurnStatus, WaterfallDialog, ChoicePrompt  } = require('botbuilder-dialogs');

const { DispatchService, LuisService, QnaMakerService }= require('botframework-config');
const { GreetingDialog } = require('./dialogs/greeting');
const { FeedbackDialog } = require('./dialogs/feedback');
const { SubscriptionDialog } = require('./dialogs/subscription');
const { FaqDialog } = require('./dialogs/faq');

// State Accessor Properties
const DIALOG_STATE_PROPERTY = 'dialogState';
const WELCOMED_USER = 'welcomedUserProperty';

// Dialog ID
const GREETING_DIALOG = 'greetingDialog';
const MENU_DIALOG = 'menuDialog';
const FEEDBACK_DIALOG = 'feedbackDialog';
const SUBSCRIPTION_DIALOG = 'subscriptionDialog';
const FAQ_DIALOG = 'faqDialog';

// Prompt
const MENU_PROMPT = 'menuPrompt';

class TescoBot extends ActivityHandler {
    constructor(conversationState, userState, luisPredictionOptions, telemetryClient) {
        if (!conversationState) throw new Error('Missing parameter.  conversationState is required');
        if (!userState) throw new Error('Missing parameter.  userState is required');
        super();

        //Pull LUIS settings
        const dispatchRecognizer = new LuisRecognizer({
            applicationId: process.env.LuisAppId,
            endpointKey: process.env.LuisAPIKey,
            endpoint: process.env.LuisAPIHostName
            }, luisPredictionOptions, true);

        this.conversationState = conversationState;
        this.userState = userState;
        this.telemetryClient = telemetryClient



        // Creates property accessor.
        this.dialogState = conversationState.createProperty(DIALOG_STATE_PROPERTY);
        this.welcomedUserProperty = userState.createProperty(WELCOMED_USER);
        //this.welcomedUserProperty = userState.createProperty(WELCOMED_FAQ_USER);
         
        this.dispatchRecognizer = dispatchRecognizer;

        // Create top-level dialog(s)
        this.dialogs = new DialogSet(this.dialogState);

        // The various dialogs
        this.dialogs.add(new ChoicePrompt(MENU_PROMPT, ()=> {return true}));
        this.dialogs.add(new GreetingDialog(GREETING_DIALOG, this.userState, telemetryClient));
        this.dialogs.add(new FeedbackDialog(FEEDBACK_DIALOG, this.userState, telemetryClient));
        this.dialogs.add(new SubscriptionDialog(SUBSCRIPTION_DIALOG, this.userState, telemetryClient));
        this.dialogs.add(new FaqDialog(FAQ_DIALOG, this.userState, telemetryClient));
        this.dialogs.add(new WaterfallDialog(MENU_DIALOG, [
            this.promptForMenu.bind(this),
            //this.handleMenuResult.bind(this),
            // this.resetDialog
        ]));


        this.onMessage(async (context, next) => {
            
            const dialogContext = await this.dialogs.createContext(context);

            //Creates a dialogue for menu
            if (context.activity.type === ActivityTypes.Message) {
                if (dialogContext.activeDialog !== null) { // If the dialog is active continue the dialog
                    await dialogContext.continueDialog();
                } else { // Else start the menu dialog
                    await dialogContext.beginDialog(MENU_DIALOG);
                }
            }

            // Save conversation state MENU_DIALOG started
            await this.conversationState.saveChanges(context);

            // First, we use the dispatch model to determine which cognitive service (LUIS or QnA) to use.
            const recognizerResult = await dispatchRecognizer.recognize(context);
        
            // Top intent tell us which cognitive service to use.
            const intent = LuisRecognizer.topIntent(recognizerResult);
        
            // Next, we call the dispatcher with the top intent.
            await this.dispatchToTopIntentAsync(context, intent, recognizerResult);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });


        this.onMembersAdded(async (context, next) => {

            const dialogContext = await this.dialogs.createContext(context);

            // Iterate over all new members added to the conversation
            for (let idx in context.activity.membersAdded) {
                // Greet anyone that was not the target (recipient) of this message.
                if (context.activity.membersAdded[idx].id !== context.activity.recipient.id) {
                    
                    // Read UserState. If the 'DidBotWelcomedUser' does not exist (first time ever for a user)
                    const didBotWelcomedUser = await this.welcomedUserProperty.get(context, false);       
                    if (didBotWelcomedUser === false) {
                        
                        const dialogTurnResult = await dialogContext.beginDialog(GREETING_DIALOG);
                        let loggedUser = await this.welcomedUserProperty.get(context, {});
                
                        if (dialogTurnResult.status === DialogTurnStatus.complete) {
                            loggedUser = dialogTurnResult.result;
                            await context.sendActivity(`Hello ${ loggedUser.firstName } ${ loggedUser.lastName }. I am Cloudy from Tesco.`);
                            await this.welcomedUserProperty.set(context, true);
                        }
                        
                        // Save User state welcomedUserProperty changes
                        await this.userState.saveChanges(context);

                        // Start the Menu Dialog
                        await dialogContext.beginDialog(MENU_DIALOG);

                        // Save conversation state MENU_DIALOG started
                        await this.conversationState.saveChanges(context);
                    }
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
            }
        );
    }

    async promptForMenu(step) {
        return await step.prompt(MENU_PROMPT, {
            choices: ["Subscription", "FAQ"],
            prompt: "How can I help you today? You can ask me question on the Azure Platform",
            retryPrompt: "I'm sorry, that wasn't a valid response. Please select one of the options"
        });
    }

    

    async resetDialog(step) {
        return step.replaceDialog(MENU_DIALOG);
    }

    async dispatchToTopIntentAsync(context, intent, recognizerResult) {
        const dialogContext = await this.dialogs.createContext(context);
        switch (intent) {
            case 'l_TescoBot':
                await this.processLUISModel(context, recognizerResult.luisResult);
                break;
            case 'q_kb_misc':
            case 'q_cpeqna_kb_microsoft':
            case 'q_cpeqna_kb_tesco':
                return dialogContext.beginDialog(FAQ_DIALOG, intent);
                break;
            default:
                console.log(`Dispatch unrecognized intent: ${ intent }.`);
                await context.sendActivity('Sorry, I do not understand what you mean. Can you rephrase?');
                break;
        }
        
        await this.conversationState.saveChanges(context);
    }
    
    async processLUISModel(context, luisResult, next) {
        console.log('Getting intent from LUIS MODEL');
        const dialogContext = await this.dialogs.createContext(context);

        // Retrieve LUIS result for Process Automation.
        const result = luisResult.connectedServiceResult;
        const intent = result.topScoringIntent.intent;
        
        switch (intent) {
            case "Greetings":
                console.log(`Routing ${ intent }.`);
                await dialogContext.beginDialog(GREETING_DIALOG);
                break;
            case "Subscription":
                console.log(`Routing ${ intent }.`);
                await dialogContext.beginDialog(SUBSCRIPTION_DIALOG);
                break;
            case "Feedback":
                console.log(`Routing ${ intent }.`);
                await dialogContext.beginDialog(FEEDBACK_DIALOG);
                break;
            case "FAQ":
                await context.sendActivity('What do you want to ask me?');
                break;
            case "None":
                await context.sendActivity('Sorry, I do not understand what you mean. Can you rephrase?');
            default:
                await dialogContext.beginDialog(MENU_DIALOG);
        }

        await this.conversationState.saveChanges(context);
    }
}

module.exports.TescoBot = TescoBot;
