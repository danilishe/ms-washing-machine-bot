import { getQueue, getUserById, hasFreeWasher } from "./state";
import { parseAsHtml, View, yourTurnView } from "./view";

setInterval(() => {
    const queue = getQueue();
    if (queue && queue.length > 0 && hasFreeWasher()) {
        const user = getUserById(queue[0]);
        const view: View = yourTurnView(user, queue.length > 1);
        notifyUser(user.id, view.message, view.config);
    }
}, 90_000);