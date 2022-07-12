

export interface Machine {
    id: string,
    name: string;
    usedBy?: UsedBy;
    status: Status;
    changedBy?: number;
    type: MachineType;
}

export const ACTION = {
    showMachine: 'select_machine_',
    useMachine: "use_machine_",
    reportInUse: "report_in_use_",
    reportIsBroken: "report_is_broken_",
    reportIsFinished: "report_is_finished_",
    confirmIsFinished: "confirm_is_finished_",
    releaseMachine: "release_machine_",
    reportIsOk: "report_is_ok_",
    standToQueue: "stand_to_queue", showStatus: "show_status",
    leaveQueue: "leave_queue",
    postponeQueue: "postpone_queue",
    showQueue: "show_queue"

}

export class UsedBy {
    userId?: number;
    start: Date;
    timeoutMin: number
    previousUser?: number;
}

export enum Status {
    FREE = "🆓",
    BUSY = "⏳",
    NOT_WORKING = "❌",
}

export function toString( s : Status): string {
    switch (s) {
        case Status.FREE: return "free";
        case Status.BUSY: return "busy";
        case Status.NOT_WORKING: return "not working";
    }
}

export enum MachineType {
    WASHING_MACHINE = 'washing-machine',
    DRYER_MACHINE = 'dryer-machine',
}


export class User {
    id: number;
    chatId: number;
    name: string;
}