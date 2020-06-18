// Import required Bot Builder
const { ComponentDialog, WaterfallDialog, TextPrompt, ChoicePrompt } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder');

const goodBotMsg = 'Thank you for your valuable feedback. Im a Good Bot.';
const badBotMsg = 'Sorry to hear that. My humans will be provided with a transcript of this conversation.';

const FEEDBACK_PROMPT = 'feedbackPrompt';
const MENU_DIALOG = 'menuDialog';
class Feedback extends ComponentDialog {
    constructor(dialogId, userState, telemetryClient) {
        super(dialogId);
        if (!userState) throw new Error('Missing parameter.  userState is required');
        this.userState = userState;

        // ID of the child dialog that should be started anytime the component is started.
        this.initialDialogId = dialogId;
        this.telemetryClient = telemetryClient;

        // Add Feedback Prompt to the Feedback Dialog
        this.addDialog(new ChoicePrompt(FEEDBACK_PROMPT, ()=> {return true}));

        // Define the conversation flow using a waterfall model.
        this.addDialog(new WaterfallDialog(dialogId, [
            this.promptForFeedback.bind(this),
            this.handleFeedbackResult.bind(this),
            async (step) => {
                // await step.endDialog();
                //return await step.beginDialog(MENU_DIALOG);
                return await step.endDialog();
            }
        ]));
    }

    async promptForFeedback(step) {
        return await step.prompt(FEEDBACK_PROMPT, {
            choices: ["Good Bot", "Bad Bot"],
            prompt: "Did I answer your question?",
            retryPrompt: "I'm sorry, that wasn't a valid response. Please select one of the options"
        });
    }

    async handleFeedbackResult(step) {
        if(step.result){
            switch (step.result.value) {
                case "Good Bot":
                    console.log("Good Bot")
                    await step.context.sendActivity(goodBotMsg);
                    break;
                case "Bad Bot":
                    console.log("Bad bot")
                    await step.context.sendActivity(badBotMsg);

                    let heroCard = CardFactory.heroCard(
                        'Feedback',
                        null,
                        CardFactory.actions([
                            {
                                type: 'openUrl',
                                title: 'Send feedback mail to Ishaan',
                                value: 'mailto:ishaan.negi@gmail.com'
                            }
                        ])
                    );

                    await step.context.sendActivity({ attachments: [ heroCard ] });
            }
            return await step.next();
        }
    }

    
}

exports.FeedbackDialog = Feedback;
