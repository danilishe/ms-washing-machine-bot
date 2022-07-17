import { Markup } from "telegraf";
import { ACTION, Machine, MachineType, Status, toString, User } from "./Entity";
import { ExtraReplyMessage } from "telegraf/typings/telegram-types";
import { getMachines, getUserById } from "./state";

export interface View {
    message: string,
    config: any;
}

export const statusView = async (queue: number[], currentUserId: number) => {
    const currentUserPos = queue.indexOf(currentUserId) + 1;
    return ({
        message: "Select machine to see additional data.\n The current status is:",
        extra: Markup.inlineKeyboard([
            [...(await getMachines(MachineType.DRYER_MACHINE))
                .map(d => Markup.button.callback(buttonLabel(d), ACTION.showMachine + d.name))],
            [...(await getMachines(MachineType.WASHING_MACHINE))
                .map(w => Markup.button.callback(buttonLabel(w), ACTION.showMachine + w.name))],
            [Markup.button.callback(
                `👥 Queue (${queue.length > 0 ? queue.length : 'empty'}), you are `
                + (currentUserPos > 0 ? "#" + currentUserPos : "not in queue")
                , ACTION.showQueue)],
        ])
    });
};

export function getUserLink(user: User) {
    if (user) {
        return `<a href="tg://user?id=${user.id}">${user.name}</a>`
    }
    return "👤<u>unknown user</u>"
}

function getEndDate(start: Date, timeoutMin: number): Date {
    return new Date(timeoutMin * 60_000 + +start);
}

function formatDateHHMM(date: Date): string {
    return slice(date.getHours()) + ":" + slice(date.getMinutes());
}

function slice(l: string | number): string {
    return ("0" + l).slice(-2)
}

export const parseAsHtml: ExtraReplyMessage = {
    parse_mode: 'HTML',
}

export const yourTurnView = (user: User, hidePostpone: boolean): View => {
    return {
        message: `Hey ${user.name}. There is a free washing machine there!`,
        config: {
            ...parseAsHtml,
            ...Markup.inlineKeyboard(
                [
                    ...commonButtons,
                    [
                        Markup.button.callback('🚶 Leave the queue', ACTION.leaveQueue),
                        Markup.button.callback('⏰ Postpone', ACTION.postponeQueue, hidePostpone),
                    ]
                ]
            )
        }
    }
}

export function queueView(users: number[], currentId: number): View {
    return {
        message: `👥 Queue status:

${users.length > 0
            ? users.map(u => "👤 " + youOrLink(u, currentId)).join("\n")
            : 'Queue is empty'}`,
        config: {
            ...parseAsHtml,
            ...Markup.inlineKeyboard(
                [
                    ...commonButtons,
                    [
                        users.indexOf(currentId) >= 0
                            ? Markup.button.callback('🚶 Leave the queue', ACTION.leaveQueue)
                            : Markup.button.callback('🧍 Stand to queue', ACTION.standToQueue)
                        ,
                    ]
                ]
            )
        }
    };
}

export function confirmFinishView(machine): View {
    return {
        message: `Do you confirm that <b>${machine.name}</b> has finished its work?
        Subscribed users will recieve message.`,
        config: {
            ...parseAsHtml,
            ...Markup.inlineKeyboard(
                [
                    Markup.button.callback('Yes', ACTION.confirmIsFinished + machine.name),
                    Markup.button.callback('No', ACTION.showMachine + machine.name),
                ]
            )
        }
    };
}

const commonButtons = [
    [
        Markup.button.callback('🔙 to status', ACTION.showStatus),
    ]
]

function buttonLabel(machine: Machine): string {
    return `${machine.name} ${machine.status}`;
}

const useMachineAction = (name: string, period: number): string => {
    return ACTION.useMachine + name + "for:" + period;
}

const isUsed = (name: string, period: number): string => {
    return ACTION.reportInUse + name + "for:" + period;
}

function getAvailableActions(machine: Machine, userId: number) {
    const usedByCurrentUser: boolean = machine.usedBy?.userId === userId;
    switch (machine.status) {
        case Status.FREE:
            return [...commonButtons,
                [
                    Markup.button.callback('👉 Take for 60', useMachineAction(machine.name, 60)),
                    Markup.button.callback('90', useMachineAction(machine.name, 90)),
                    Markup.button.callback('120', useMachineAction(machine.name, 120)),
                    Markup.button.callback('150 min', useMachineAction(machine.name, 150)),
                ],
                [
                    Markup.button.callback('⚠ In use for 20', isUsed(machine.name, 20)),
                    Markup.button.callback('30', isUsed(machine.name, 30)),
                    Markup.button.callback('50', isUsed(machine.name, 50)),
                    Markup.button.callback('70', isUsed(machine.name, 70)),
                    Markup.button.callback('90 min', isUsed(machine.name, 90)),
                ],
                [
                    Markup.button.callback('💀 Report is broken', ACTION.reportIsBroken + machine.name),
                ]
            ];
        case Status.BUSY:
            return [...commonButtons,
                [
                    usedByCurrentUser
                        ? Markup.button.callback('⏏ Release ', ACTION.releaseMachine + machine.name)
                        : Markup.button.callback('🔔 Report is finished ', ACTION.reportIsFinished + machine.name),
                ]
            ];
        case Status.NOT_WORKING:
            return [...commonButtons,
                [
                    Markup.button.callback('🔔️ Report is ok ', ACTION.reportIsOk + machine.name),
                ]
            ]
    }

}

export const machineView = async (machine: Machine, userId: number): Promise<View> => {
    return {
        message: `Machine <b>${machine.name}</b> page
                It is <b>${toString(machine.status) + machine.status}</b> now
                ${await getStatusInfo(machine, userId)}`,
        config: {
            ...parseAsHtml,
            ...Markup.inlineKeyboard(getAvailableActions(machine, userId))
        }
    };
}

async function youOrLink(userId: number, currentUserId: number): Promise<string> {
    return getUserLink(await getUserById(userId)) + (userId === currentUserId
        ? "(You)"
        : "");
}

async function getStatusInfo(machine: Machine, userId: number): Promise<string> {
    switch (machine.status) {
        case Status.NOT_WORKING:
            return `Status: <b>Not working</b> 
reported by: ${await youOrLink(machine.changedBy, userId)}`;
        case Status.BUSY:
            const endDate = getEndDate(machine.usedBy.start, machine.usedBy.timeoutMin);
            return `Used by ${await youOrLink(machine.usedBy?.userId, userId)} until 📅 ${formatDateHHMM(endDate)}`;
        case Status.FREE:
            return `Should be free now.
            Last used by ${await youOrLink(machine.usedBy?.previousUser, userId)}`
    }
}
