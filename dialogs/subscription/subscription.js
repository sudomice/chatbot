// Import required Bot Builder
const { ComponentDialog, WaterfallDialog } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder');

const { FeedbackDialog } = require('../feedback');
const FEEDBACK_DIALOG = 'feedbackDialog';
class Subscription extends ComponentDialog {
    constructor(dialogId, userState, telemetryClient) {
        super(dialogId);
        if (!userState) throw new Error('Missing parameter.  userState is required');
        this.userState = userState;

        // ID of the child dialog that should be started anytime the component is started.
        this.initialDialogId = dialogId;
        this.telemetryClient = telemetryClient;
        async function createHeroCard() {
            return CardFactory.heroCard(
            'Subscription',
            null,
            CardFactory.actions([
                {
                    type: 'openUrl',
                    title: 'Request new subscription',
                    value: 'https://github.com/sudomice'
                }
            ]));
        }


        // // Define the conversation flow using a waterfall model.
        this.addDialog(new WaterfallDialog(dialogId, [
            async (step) => {
                //case 'Hero Card':
                const heroCard = await createHeroCard();
                await step.context.sendActivity({ attachments: [ heroCard ] });
                return await step.next();
            },
            async (step) => {
                return await step.beginDialog(FEEDBACK_DIALOG);
            }
        ]));
    }
}


exports.SubscriptionDialog = Subscription;
