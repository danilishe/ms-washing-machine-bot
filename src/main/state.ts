import { Machine, MachineType, Status, User } from "./Entity";
import * as fs from "fs";

const users = new Map<number, User>();
let queue: number[] = [];

function createMachine(name: string, status: Status, type: MachineType) {
    return { name, status, type };
}

const washers: Machine[] = [
    createMachine("Washer 1", Status.FREE, MachineType.WASHING_MACHINE),
    createMachine("Washer 2", Status.FREE, MachineType.WASHING_MACHINE),
    createMachine("Washer 3", Status.FREE, MachineType.WASHING_MACHINE),
];
const dryers: Machine[] = [
    createMachine("Dryer 1", Status.FREE, MachineType.DRYER_MACHINE),
    createMachine("Dryer 2", Status.FREE, MachineType.DRYER_MACHINE),
    createMachine("Dryer 3", Status.FREE, MachineType.DRYER_MACHINE),
];
const allMachines = [...washers, ...dryers];

export { washers, dryers, allMachines }

export function getMachineByName(name: string): Machine {
    let machines: Machine[] = allMachines.filter(m => m.name === name);
    if (machines.length === 0) throw new Error(`No such machine with name ${name}`);
    if (machines.length > 1) throw new Error(`There is more than one machine with name ${name}`);
    return machines[0];
}

export function getUserById(userId: number): User {
    return users.get(userId);
}

export function addUsers(usrs: User[]) {
    console.log(usrs);
    console.log("Users were restored: " + usrs.length);
    for (const usr of usrs) {
        users.set(usr.id, usr);
        console.log(usr);
    }
}

export function collectUserData(ctx) {
    const from = ctx.from;
    const userName = from.username || from.first_name + " " + from.last_name || "noname";
    users.set(from.id, { name: userName, id: from.id, chatId: ctx.chat.id });
    const usersJson = JSON.stringify([...users.values()], null, 4);
    fs.writeFileSync('./users.json', usersJson, { encoding: 'utf8', flag: 'w' });
    console.log("Saved users:\n", usersJson);
}

export function isInQueue(id: number): boolean {
    return getQueue().indexOf(id) >= 0;
}

export function removeFromQueue(id: number) {
    queue = queue.filter(i => i !== id);
}

export function postponeQueue() {
    queue = [queue[1], queue[0], ...queue.splice(2)];
}

export function getQueue(): number[] {
    return [...queue];
}

export function addToQueue(id: number) {
    queue.push(id);
}

export function hasFreeWasher(): boolean {
    return washers.filter(w => w.status == Status.FREE).length > 0;
}
