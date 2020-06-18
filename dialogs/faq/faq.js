
const { ComponentDialog, WaterfallDialog, TextPrompt } = require('botbuilder-dialogs');
const { QnAMaker } = require('botbuilder-ai');
const { FeedbackDialog } = require('../feedback');

const FEEDBACK_DIALOG = 'feedbackDialog';

class Faq extends ComponentDialog { 
           
    constructor(dialogId, userState, telemetryClient) {
        const cpeqna_kb_microsoft = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId_microsoft,
            endpointKey: process.env.QnAAuthKey_microsoft,
            host: process.env.QnAEndpointHostName_microsoft
        },undefined, telemetryClient, true);
        const cpeqna_kb_tesco = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId_tesco,
            endpointKey: process.env.QnAAuthKey_tesco,
            host: process.env.QnAEndpointHostName_tesco
        }, undefined, telemetryClient, true);
        const kb_misc = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId_misc,
            endpointKey: process.env.QnAEndpointHostName_misc,
            host: process.env.QnAKnowledgebaseId_misc
        }, undefined, telemetryClient, true);

        super(dialogId);
        if (!userState) throw new Error('Missing parameter.  userState is required');
        this.userState = userState;
        this.telemetryClient = telemetryClient;

        // ID of the child dialog that should be started anytime the component is started.
        this.initialDialogId = dialogId;

        this.cpeqna_kb_microsoft = cpeqna_kb_microsoft;
        this.cpeqna_kb_tesco = cpeqna_kb_tesco;
        this.kb_misc = kb_misc;

        // Define the prompts used in this conversation flow.
        this.addDialog(new TextPrompt('textPrompt'));


        // Define the conversation flow using a waterfall model.
        this.addDialog(new WaterfallDialog(dialogId, [
           this.callFaqService.bind(this),
            // async (step) => {
            //     return await step.beginDialog(FEEDBACK_DIALOG);
            // }
            this.callFeedbackDialog.bind(this)
        ]));
    }

    async callFeedbackDialog(step) {
        return await step.beginDialog(FEEDBACK_DIALOG);
    }

    async callFaqService (step) {        
        let qnaResults;
        if (step.options == "q_cpeqna_kb_microsoft") {
            qnaResults = await this.cpeqna_kb_microsoft.getAnswers(step.context);
        } else if (step.options == "q_cpeqna_kb_tesco") {
            qnaResults = await this.cpeqna_kb_tesco.getAnswers(step.context);
        } else if (step.options == "q_kb_misc"){
            qnaResults = await this.kb_misc.getAnswers(step.context);
        }
                
        if (qnaResults[0]) {
            await step.context.sendActivity(qnaResults[0].answer);
        } else {
            await step.context.sendActivity('No QnA Maker answers were found.');
        }
        return await step.next();
    }
}

exports.FaqDialog = Faq;
