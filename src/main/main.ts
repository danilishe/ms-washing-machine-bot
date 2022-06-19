import { Telegraf } from 'telegraf'
import {
    confirmFinishView,
    getUserLink,
    machineView,
    parseAsHtml,
    queueView,
    statusView,
    View,
    yourTurnView
} from "./view";
import {
    addToQueue, addUsers,
    collectUserData,
    getMachineByName,
    getQueue,
    getUserById,
    hasFreeWasher, isInQueue,
    postponeQueue,
    removeFromQueue
} from "./state";
import { ACTION, Machine, Status, User } from "./Entity";
import * as fs from "fs";

const bot = new Telegraf(process.env.API_KEY);

const showMachineState = new RegExp(ACTION.showMachine + "(.+)");
const useMachine = new RegExp(ACTION.useMachine + "(.+)for:(\\d+)");
const releaseMachine = new RegExp(ACTION.releaseMachine + "(.+)");
const machineReportInUse = new RegExp(ACTION.reportInUse + "(.+)for:(\\d+)");
const machineReportIsBroken = new RegExp(ACTION.reportIsBroken + "(.+)");
const machineReportIsOk = new RegExp(ACTION.reportIsOk + "(.+)");
const machineReportFinished = new RegExp(ACTION.reportIsFinished + "(.+)");
const machineConfirmFinished = new RegExp(ACTION.confirmIsFinished + "(.+)");

bot.command("start", ctx => {
    collectUserData(ctx);
    const view = statusView(getQueue(), ctx.from.id);
    ctx.reply(view.message, view.extra);
});

bot.command("status", ctx => {
    const view = statusView(getQueue(), ctx.from.id);
    ctx.reply(view.message, view.extra);
});

// logging
bot.action(/.*/, (ctx, next) => {
    console.log(`got '${ctx.update.callback_query.data}' from ${ctx.from.username}`);
    next();
});

function backToMachine(ctx, machine: Machine) {
    const view = machineView(machine, ctx.from.id);
    return ctx.editMessageText(view.message, view.config);
}

const backToStatus = ctx => {
    const view = statusView(getQueue(), ctx.from.id);
    ctx.editMessageText(view.message, view.extra);
};

function backToQueue(ctx) {
    const view = queueView(getQueue(), ctx.from.id);
    ctx.editMessageText(view.message, view.config);
}

bot.action(ACTION.showStatus, backToStatus);

bot.action(showMachineState, ctx => backToMachine(ctx, getMachineByName(ctx.match[1])));

bot.action(useMachine, ctx => {
    const userId = ctx.from.id;
    const machine = getMachineByName(ctx.match[1]);
    const timeout: number = parseInt(ctx.match[2]);
    machine.usedBy = {
        userId: userId,
        previousUser: machine.usedBy?.previousUser,
        start: new Date(),
        timeoutMin: timeout,
    };
    machine.status = Status.BUSY;
    setWatcher(machine, setTimeout(() => {
        notifyUser(userId, `Your program on <b>${machine.name}</b> should be finished. Please take your things. Machine will be released automatically.`);
        cancelWatchers(machine);
        machine.usedBy = {
            userId: undefined,
            previousUser: userId,
            start: new Date(),
            timeoutMin: 0,
        };
        machine.status = Status.FREE;
    }, timeout * 60_000))
    removeFromQueue(userId);
    ctx.answerCbQuery(`Now you are using ${machine.name}`);
    backToMachine(ctx, machine);
})

bot.action(releaseMachine, ctx => {
    const userId = ctx.from.id;
    const machine = getMachineByName(ctx.match[1]);
    if (userId !== machine.usedBy.userId) {
        ctx.answerCbQuery(`You don't use ${machine.name}. Nothing changed.`);
        return backToMachine(ctx, machine);
    }

    machine.usedBy = {
        userId: undefined,
        previousUser: userId,
        start: new Date(),
        timeoutMin: 0,
    };
    machine.status = Status.FREE;
    cancelWatchers(machine);
    ctx.answerCbQuery(`You have released ${machine.name}`);
    backToMachine(ctx, machine);
})

function cancelWatchers(machine: Machine) {
    if (machine.watchers) {
        machine.watchers.forEach(w => clearTimeout(w));
    }
    machine.watchers = [];
}

function setWatcher(machine: Machine, timeout: NodeJS.Timeout) {
    cancelWatchers(machine);
    machine.watchers = [timeout];
}

bot.action(machineReportInUse, ctx => {
        const machine = getMachineByName(ctx.match[1]);
        const timeout: number = parseInt(ctx.match[2]);
        machine.usedBy = {
            userId: undefined,
            start: new Date(),
            timeoutMin: timeout,
        };
        machine.status = Status.BUSY;
        machine.changedBy = ctx.from.id;
        setWatcher(machine, setTimeout(() => {
            machine.status = Status.FREE;
            cancelWatchers(machine);
        }, timeout * 60_000));
        ctx.answerCbQuery(`Thanks for report!`);
        backToMachine(ctx, machine);
    }
);

bot.action(machineReportIsBroken, ctx => {
        const machine = getMachineByName(ctx.match[1]);
        const usedById = machine.usedBy?.userId;
        const currentUserId = ctx.from.id;
        if (usedById && usedById !== currentUserId) {
            notifyUser(usedById,
                `User ${getUserLink(getUserById(currentUserId))} informs, that machine <b>${machine}</b> you have been using, is broken.
                    Please take your things`);
        }
        machine.usedBy = {
            userId: undefined,
            previousUser: usedById,
            start: new Date(),
            timeoutMin: 9999999,
        };
        machine.status = Status.NOT_WORKING;
        machine.changedBy = currentUserId;
        cancelWatchers(machine);
        ctx.answerCbQuery(`Thanks for report!`);
        backToMachine(ctx, machine);
    }
);


bot.action(machineReportIsOk, ctx => {
        const userId = ctx.from.id;
        const machine = getMachineByName(ctx.match[1]);
        if (machine.changedBy && userId !== machine.changedBy) {
            notifyUser(machine.changedBy, `${getUserLink(getUserById(userId))} reports that machine <b>${machine.name}</b> you marked as broken, is fixed now`);
        }
        machine.usedBy = {
            userId: undefined,
            start: new Date(),
            timeoutMin: 0
        };
        machine.changedBy = userId;
        machine.status = Status.FREE;
        ctx.answerCbQuery(`Thanks for report!`);
        backToMachine(ctx, machine);
    }
);

bot.action(machineReportFinished, ctx => {
        const machine = getMachineByName(ctx.match[1]);
        const view = confirmFinishView(machine);
        ctx.editMessageText(view.message, view.config);
    }
);

bot.action(machineConfirmFinished, ctx => {
        const machine = getMachineByName(ctx.match[1]);
        const user = getUserById(ctx.from.id);
        notifyUser(machine.usedBy.userId, `${getUserLink(user)} wants to inform you, that ${machine.name} has finished its work`);
        machine.usedBy = {
            userId: undefined,
            start: new Date(),
            timeoutMin: 0
        };
        cancelWatchers(machine);
        machine.status = Status.FREE;
        machine.changedBy = user.id;
        backToMachine(ctx, machine);
    }
);

bot.action(ACTION.standToQueue, ctx => {
    const user = getUserById(ctx.from.id);
    if (hasFreeWasher()) {
        return ctx.answerCbQuery(`There is a free machine, try to use it`, { show_alert: true });
    }
    if (isInQueue(user.id)) {
        return ctx.answerCbQuery(`Looks like you already in queue`, { show_alert: true })
    }
    addToQueue(user.id);
    ctx.answerCbQuery(`Queued!`);
    backToQueue(ctx);
})

bot.action(ACTION.showQueue, backToQueue);

bot.action(ACTION.leaveQueue, ctx => {
    removeFromQueue(ctx.from.id);
    ctx.answerCbQuery(`You were removed from queue!`);
    backToQueue(ctx);
})

bot.action(ACTION.postponeQueue, ctx => {
    postponeQueue();
    backToQueue(ctx);
    ctx.answerCbQuery("Your turn is postponed");
});

function notifyUser(userId: number, s: string, config?) {
    const user = getUserById(userId);
    console.log(`notify user ${user}: ${s}`);
    try {
        bot.telegram.sendMessage(user.chatId, s, config || parseAsHtml);
    } catch (e) {
        console.error(e);
    }
}

setInterval(() => {
    const queue = getQueue();
    if (queue && queue.length > 0 && hasFreeWasher()) {
        const user = getUserById(queue[0]);
        const view: View = yourTurnView(user, queue.length > 1);
        notifyUser(user.id, view.message, view.config);
    }
}, 90_000);

fs.readFile('./users.json', (err, data) => {
    if (err) {
        console.warn(err.message);
        return;
    }
    const text = data.toString("utf-8");
    console.log(text);
    const users = JSON.parse(text) as User[];
    addUsers(users);
});

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
