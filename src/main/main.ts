import { Telegraf } from 'telegraf'
import { confirmFinishView, getUserLink, machineView, parseAsHtml, statusView } from "./view";
import { collectUserData, getMachineById, getQueue, getUserById, updateMachine } from "./state";
import { ACTION, Machine, Status } from "./Entity";

const bot = new Telegraf(process.env.API_KEY);

const showMachineState = new RegExp(ACTION.showMachine + "(.+)");
const useMachine = new RegExp(ACTION.useMachine + "(.+)for:(\\d+)");
const releaseMachine = new RegExp(ACTION.releaseMachine + "(.+)");
const machineReportInUse = new RegExp(ACTION.reportInUse + "(.+)for:(\\d+)");
const machineReportIsBroken = new RegExp(ACTION.reportIsBroken + "(.+)");
const machineReportIsOk = new RegExp(ACTION.reportIsOk + "(.+)");
const machineReportFinished = new RegExp(ACTION.reportIsFinished + "(.+)");
const machineConfirmFinished = new RegExp(ACTION.confirmIsFinished + "(.+)");

// todo: remove queue: only single user
// remove extra buttons from views
// deploy alert server, which will inform about end
// deploy to fire functions bot
// add queue as alert service when machine is free
// you done
bot.catch((err, ctx) => {
    console.log("Error happened during update: ", ctx.update);
    console.error("Error:", err);
})

bot.command("start", async (ctx) => {
    await collectUserData(ctx);
    const view = await statusView(getQueue(), ctx.from.id);
    ctx.reply(view.message, view.extra);
});

bot.command("status", async (ctx) => {
    const view = await statusView(getQueue(), ctx.from.id);
    ctx.reply(view.message, view.extra);
});

// logging
bot.action(/.*/, (ctx, next) => {
    console.log(`got '${ctx.update.callback_query.data}' from ${ctx.from.username}`);
    next();
});

async function backToMachine(ctx, machine: Machine) {
    const view = await machineView(machine, ctx.from.id);
    return ctx.editMessageText(view.message, view.config);
}

async function backToStatus(ctx) {
    const view = await statusView(getQueue(), ctx.from.id);
    return ctx.editMessageText(view.message, view.extra);
}

/*async function backToQueue(ctx) {
    const view = await queueView(getQueue(), ctx.from.id);
    ctx.editMessageText(view.message, view.config);
}*/

bot.action(ACTION.showStatus, backToStatus);

bot.action(showMachineState, async (ctx) => backToMachine(ctx, await getMachineById(ctx.match[1])));

bot.action(useMachine, async (ctx) => {
    const userId = ctx.from.id;
    const timeout: number = parseInt(ctx.match[2]);
    const machine = await getMachineById(ctx.match[1]);
    const update = {
        ...machine,
        status: Status.BUSY,
        usedBy: {
            userId: userId,
            previousUser: machine.usedBy?.previousUser,
            start: new Date(),
            timeoutMin: timeout,
        }
    };
    return Promise.all([
        updateMachine(update),
        ctx.answerCbQuery(`Now you are using ${machine.name}`),
        backToMachine(ctx, update),
    ])
    // setWatcher(machine, setTimeout(() => {
    //     notifyUser(userId, `Your program on <b>${machine.name}</b> should be finished. Please take your things. Machine will be released automatically.`);
    //     cancelWatchers(machine);
    //     machine.usedBy = {
    //         userId: undefined,
    //         previousUser: userId,
    //         start: new Date(),
    //         timeoutMin: 0,
    //     };
    //     machine.status = Status.FREE;
    // }, timeout * 60_000))
    // await removeFromQueue(userId);
})

bot.action(releaseMachine, async (ctx) => {
    const userId = ctx.from.id;
    const machine = await getMachineById(ctx.match[1]);
    if (userId !== machine.usedBy?.userId) {
        ctx.answerCbQuery(`You don't use ${machine.name}. Nothing changed.`);
        return backToMachine(ctx, machine);
    }
    const update = {
        ...machine,
        usedBy: {
            userId: undefined,
            previousUser: userId,
            start: new Date(),
            timeoutMin: 0,
        },
        status: Status.FREE
    }
    return Promise.all([
        updateMachine(update).then(_ => backToStatus(ctx)),
        ctx.answerCbQuery(`You have released ${update.name}`),
        // cancelWatchers(machine);
    ])
})

// function cancelWatchers(machine: Machine) {
//     if (machine.watchers) {
//         machine.watchers.forEach(w => clearTimeout(w));
//     }
//     machine.watchers = [];
// }
//
// function setWatcher(machine: Machine, timeout: NodeJS.Timeout) {
//     cancelWatchers(machine);
//     machine.watchers = [timeout];
// }

bot.action(machineReportInUse, async (ctx) => {
        const machine = await getMachineById(ctx.match[1]);
        const timeout: number = parseInt(ctx.match[2]);
        const update = {
            ...machine,
            usedBy: {
                userId: undefined,
                start: new Date(),
                timeoutMin: timeout,
            },
            status: Status.BUSY,
            changedBy: ctx.from.id,
        }
        return Promise.all([
            updateMachine(update),
            ctx.answerCbQuery(`Thanks for report!`),
            backToMachine(ctx, update),
            // setWatcher(machine, setTimeout(() => {
            //     machine.status = Status.FREE;
            //     cancelWatchers(machine);
            // }, timeout * 60_000));          
        ])
    }
);

bot.action(machineReportIsBroken, async (ctx) => {
        const machine = await getMachineById(ctx.match[1]);
        const usedById = machine.usedBy?.userId;
        const currentUserId = ctx.from.id;
        // if (usedById && usedById !== currentUserId) {
        //     notifyUser(usedById,
        //         `User ${getUserLink(getUserById(currentUserId))} informs, that machine <b>${machine}</b> you have been using, is broken.
        //             Please take your things`);
        // }
        const update = {
            ...machine,
            usedBy: {
                userId: undefined,
                previousUser: usedById,
                start: new Date(),
                timeoutMin: 9999999,
            },
            status: Status.NOT_WORKING,
            changedBy: currentUserId,
        };
        return Promise.all([
            updateMachine(update).then(_ => backToStatus(ctx)),
            ctx.answerCbQuery(`Thanks for report!`),
            /* cancelWatchers(machine); */
        ])
    }
);


bot.action(machineReportIsOk, async (ctx) => {
        const user = await getUserById(ctx.from.id);
        const machine = await getMachineById(ctx.match[1]);
        if (machine.changedBy && user.id !== machine.changedBy) {
            await notifyUser(machine.changedBy, `${getUserLink(user)} reports that machine <b>${machine.name}</b> you marked as broken, is ok now`);
        }
        const update = {
            ...machine,
            usedBy: {
                userId: undefined,
                start: new Date(),
                timeoutMin: 0
            },
            changedBy: user.id,
            status: Status.FREE,
        };
        return Promise.all([
            updateMachine(update),
            ctx.answerCbQuery(`Thanks for report!`),
            backToMachine(ctx, update),
        ])
    }
);

bot.action(machineReportFinished, async (ctx) => {
        const machine = await getMachineById(ctx.match[1]);
        const view = confirmFinishView(machine);
        return ctx.editMessageText(view.message, view.config);
    }
);

bot.action(machineConfirmFinished, async (ctx) => {
        const machine = await getMachineById(ctx.match[1]);
        const user = await getUserById(ctx.from.id);
        // cancelWatchers(machine);
        const update = {
            ...machine,
            status: Status.FREE,
            changedBy: user.id,
            usedBy: {
                userId: undefined,
                start: new Date(),
                timeoutMin: 0
            }
        };
        return Promise.all([
            notifyUser(machine.usedBy.userId, `${getUserLink(user)} wants to inform you, that ${machine.name} has finished its work`),
            updateMachine(update),
            backToMachine(ctx, update),
        ]);
    }
);
/*

bot.action(ACTION.standToQueue, async (ctx) => {
    if (await hasFree(MachineType.WASHING_MACHINE)) {
        return ctx.answerCbQuery(`There is a free machine, try to use it`, { show_alert: true });
    }
    if (isInQueue(ctx.from.id)) {
        return ctx.answerCbQuery(`Looks like you already in queue`, { show_alert: true })
    }
    addToQueue(ctx.from.id);
    ctx.answerCbQuery(`Queued!`);
    await backToQueue(ctx);
})
*/

/*

bot.action(ACTION.showQueue, backToQueue);

bot.action(ACTION.leaveQueue, async (ctx) => {
    removeFromQueue(ctx.from.id);
    ctx.answerCbQuery(`You were removed from queue!`);
    return backToQueue(ctx);
})

bot.action(ACTION.postponeQueue, async (ctx) => {
    postponeQueue(); // todo: does not work
    return Promise.all([
        backToQueue(ctx),
        ctx.answerCbQuery("Your turn is postponed"),
    ]);
});
*/

async function notifyUser(userId: number, s: string, config?) {
    const user = await getUserById(userId);
    try {
        await bot.telegram.sendMessage(user.chatId, s, config || parseAsHtml);
    } catch (e) {
        console.error(e);
    }
}

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
