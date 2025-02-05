import { definePlugin } from "@utils/plugins";
import { Devs } from "@utils/constants";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

// Rest of the code remains exactly the same, just the import changed
const MessageStore = findByPropsLazy("getMessage", "getMessages");
const SelectedChannelStore = findByPropsLazy("getChannelId");

class ResponseGenerator {
    private patterns = new Map([
        [/(how are|how're) you/i, ["I'm good, thanks!", "Doing well, you?", "Pretty good!"]],
        [/\?$/, ["Yes", "No", "Maybe", "I think so", "Not sure"]],
        [/(hello|hi|hey)/i, ["Hey!", "Hi there!", "Hello!"]],
        [/(thanks|thank you)/i, ["You're welcome!", "No problem!", "Anytime!"]],
        [/(good morning|morning)/i, ["Good morning!", "Morning!", "Have a great day!"]],
        [/(good night|night)/i, ["Good night!", "Night!", "Sleep well!"]],
        [/(lol|lmao|haha)/i, ["😄", "😂", "haha"]],
    ]);

    private contextResponses = {
        question: ["I think...", "In my opinion...", "From what I know..."],
        statement: ["Agreed!", "Interesting point!", "Makes sense"],
        exclamation: ["Nice!", "Awesome!", "Cool!"],
    };

    generateSuggestions(message: string): string[] {
        const suggestions: string[] = [];

        // Check pattern matches
        for (const [pattern, responses] of this.patterns) {
            if (pattern.test(message)) {
                suggestions.push(...responses.slice(0, 2));
            }
        }

        // Add context-based responses
        if (message.endsWith("?")) {
            suggestions.push(...this.contextResponses.question.slice(0, 2));
        } else if (message.endsWith("!")) {
            suggestions.push(...this.contextResponses.exclamation.slice(0, 2));
        } else {
            suggestions.push(...this.contextResponses.statement.slice(0, 2));
        }

        // Deduplicate and limit suggestions
        return [...new Set(suggestions)].slice(0, 3);
    }
}

export default definePlugin({
    name: "ReplySuggestions",
    description: "Suggests contextual replies for messages",
    authors: "Rishi",
    dependencies: [],

    responseGenerator: new ResponseGenerator(),

    patches: [
        {
            find: ".Messages.MESSAGE_CONTEXT_MENU",
            replacement: {
                match: /(?<=function\s*\w+\s*\([^)]*\)\s*{)/,
                replace: `
                    const suggestions = Vencord.Plugins.plugins.ReplySuggestions.getSuggestions();
                    if (suggestions && suggestions.length) {
                        arguments[0].unshift({
                            type: "submenu",
                            label: "Reply Suggestions",
                            items: suggestions.map(s => ({
                                label: s,
                                action: () => {
                                    Vencord.Plugins.plugins.ReplySuggestions.insertReply(s);
                                }
                            }))
                        });
                    }
                `
            }
        }
    ],

    getSuggestions() {
        const channelId = SelectedChannelStore.getChannelId();
        const messages = MessageStore.getMessages(channelId)?.toArray() ?? [];
        
        if (messages.length < 1) return [];

        const lastMessage = messages[messages.length - 1];
        return this.responseGenerator.generateSuggestions(lastMessage.content);
    },

    insertReply(suggestion: string) {
        FluxDispatcher.dispatch({
            type: "INSERT_TEXT",
            textValue: suggestion
        });
    },

    settings: {
        maxSuggestions: {
            type: "number",
            name: "Max Suggestions",
            note: "Maximum number of suggestions to show",
            default: 3,
            minimum: 1,
            maximum: 5
        }
    },

    start() {},
    stop() {}
});