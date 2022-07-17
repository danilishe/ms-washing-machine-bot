import { Machine, MachineType, Status } from "./main/Entity";
import { machinesDb } from "./main/state";

const machines: Machine[] = [
    { id: "Washer 1", name: "Washer 1", status: Status.FREE, type: MachineType.WASHING_MACHINE },
    { id: "Washer 2", name: "Washer 2", status: Status.FREE, type: MachineType.WASHING_MACHINE },
    { id: "Washer 3", name: "Washer 3", status: Status.FREE, type: MachineType.WASHING_MACHINE },
    { id: "Dryer 1", name: "Dryer 1", status: Status.FREE, type: MachineType.DRYER_MACHINE },
    { id: "Dryer 2", name: "Dryer 2", status: Status.FREE, type: MachineType.DRYER_MACHINE },
    { id: "Dryer 3", name: "Dryer 3", status: Status.FREE, type: MachineType.DRYER_MACHINE },
];
console.log("adding...")
machines.forEach(m => machinesDb.doc(m.id).set(m));
console.log("done.")