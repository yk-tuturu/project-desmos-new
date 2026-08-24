export function parseCommandToGraph(command: any): string {
    if (command.code === 'Q') {
        const x0 = command.x0;
        const y0 = -command.y0;
        const x1 = command.x1;
        const y1 = -command.y1;
        const x2 = command.x;
        const y2 = -command.y;

        return `((1-t)^2(${x0}) + 2(1-t)(t)(${x1}) + t^2(${x2}), (1-t)^2(${y0}) + 2(1-t)(t)(${y1}) + t^2(${y2}))`;
    } else if (command.code === 'L') {
        const x0 = command.x0;
        const y0 = -command.y0;
        const x1 = command.x;
        const y1 = -command.y;

        return `((1-t)(${x0}) + t(${x1}), (1-t)(${y0}) + t(${y1}))`;
    } else if (command.code === 'C') {
        const x0 = command.x0;
        const y0 = -command.y0;
        const x1 = command.x1;
        const y1 = -command.y1;
        const x2 = command.x2;
        const y2 = -command.y2;
        const x3 = command.x;
        const y3 = -command.y;
        return `((1-t)^3(${x0}) + 3(1-t)^2(t)(${x1}) + 3(1-t)(t^2)(${x2}) + t^3(${x3}), (1-t)^3(${y0}) + 3(1-t)^2(t)(${y1}) + 3(1-t)(t^2)(${y2}) + t^3(${y3}))`;
    } else {
        return '';
    }
}

function pointAt(command: any, t: number): { x: number; y: number } {
    const mt = 1 - t;

    if (command.code === 'Q') {
        return {
            x: mt ** 2 * command.x0 + 2 * mt * t * command.x1 + t ** 2 * command.x,
            y: mt ** 2 * command.y0 + 2 * mt * t * command.y1 + t ** 2 * command.y,
        };
    }
    if (command.code === 'C') {
        return {
            x: mt ** 3 * command.x0 + 3 * mt ** 2 * t * command.x1 + 3 * mt * t ** 2 * command.x2 + t ** 3 * command.x,
            y: mt ** 3 * command.y0 + 3 * mt ** 2 * t * command.y1 + 3 * mt * t ** 2 * command.y2 + t ** 3 * command.y,
        };
    }
    // L, and anything else treated as a straight line
    return {
        x: mt * command.x0 + t * command.x,
        y: mt * command.y0 + t * command.y,
    };
}

function curveLength(command: any, samples = 12): number {
    let length = 0;
    let prev = pointAt(command, 0);
    for (let i = 1; i <= samples; i++) {
        const curr = pointAt(command, i / samples);
        length += Math.hypot(curr.x - prev.x, curr.y - prev.y);
        prev = curr;
    }
    return length;
}

export function parseCommands(commands: any[], minLength: number = 3): string[] {
    return commands
        .filter(command => curveLength(command) > minLength)
        .map(command => parseCommandToGraph(command))
        .filter(expr => expr !== '');
}