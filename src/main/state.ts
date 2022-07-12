import { Machine, MachineType, Status, toString, User } from "./Entity";
import * as fs from "fs";
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = require('C:\\Users\\sueti\\IdeaProjects\\washing-bot\\telegram-bot-3c34c-83aa5dd81c3c.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const machineConverter = {
    toFirestore(machine: Machine): FirebaseFirestore.DocumentData {
        return { name: machine.name, status: machine.status };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Machine {
        const data = snapshot.data();
        return { id: data.id, name: data.name, status: data.status, type: data.type };
    }
};
const userConverter = {
    toFirestore(user: User): FirebaseFirestore.DocumentData {
        return { name: user.name, chatId: user.chatId, id: user.id };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): User {
        const data = snapshot.data();
        return { name: data.name, chatId: data.chatId, id: data.id };
    }
};

const usersDb = db.collection("users").withConverter(userConverter);
export const machinesDb = db.collection("machines").withConverter(machineConverter);

let queue: number[] = [];

export async function getMachines(type: MachineType): Promise<Machine[]> {
    const dryers = await machinesDb.where("type", "==", type).get();
    return dryers.docs.map(qr => qr.data());
}

export async function getMachineById(id: string): Promise<Machine> {
    return await machinesDb.doc(id).get()
        .then(doc => doc.data());
}

export async function getUserById(userId: number): Promise<User> {
    return usersDb.doc(String(userId)).get().then(d => d.data());
}

export async function collectUserData(ctx) {
    const from = ctx.from;
    const userName = from.username || from.first_name + " " + from.last_name || "noname";
    await usersDb.doc(from.id).set({ name: userName, id: from.id, chatId: ctx.chat.id });
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

export async function hasFree(type: MachineType): Promise<boolean> {
    return getMachines(type)
        .then(machine => machine.filter(w => w.status == Status.FREE).length > 0);
}
