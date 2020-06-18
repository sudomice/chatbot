// Import required Bot Builder
const { ComponentDialog, WaterfallDialog, TextPrompt } = require('botbuilder-dialogs');

class Greeting extends ComponentDialog {    
    constructor(dialogId, userState, telemetryClient) {
        super(dialogId);
        if (!userState) throw new Error('Missing parameter.  userState is required');
        this.userState = userState;

        // ID of the child dialog that should be started anytime the component is started.
        this.initialDialogId = dialogId;
        this.telemetryClient = telemetryClient;

        // Define the prompts used in this conversation flow.
        this.addDialog(new TextPrompt('textPrompt'));

        // Define the conversation flow using a waterfall model.
        this.addDialog(new WaterfallDialog(dialogId, [
            async function (step) {
                //Future Code - Get User Token
                //Future Code - Store the value in the UserProperty
                
                step.values.loggedUser = {};
                step.values.loggedUser.firstName = "Test";
                step.values.loggedUser.lastName = "User";
                return await step.endDialog(step.values.loggedUser);
            },
        ]));
    }
}

exports.GreetingDialog = Greeting;
