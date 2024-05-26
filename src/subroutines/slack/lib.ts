import { Prisma } from "@prisma/client";
import { Environment } from "../../lib/constants.js";

import { app } from "../../lib/bolt.js";
import { prisma } from "../../lib/prisma.js";
import { Controller } from "../../views/controller.js";

import { t } from "../../lib/templates.js";

export type Session = Prisma.SessionGetPayload<{}>;

export async function updateController(session: Session) {
    await app.client.chat.update({
        ts: session.controlTs,
        channel: Environment.MAIN_CHANNEL,
        blocks: await Controller.panel(session),
        text: "todo: replace with accessibility friendly text" // TODO: Replace with accessibility friendly text
    });
}

export async function fetchSlackId(userId: string) {
    const slackUser = await prisma.slackUser.findFirst({
        where: {
            user: {
                id: userId
            }
        }
    });

    if (!slackUser) {
        throw new Error(`Could not find slack user for ${userId}`);
    }

    return slackUser.slackId;
}

// Function that sends an ephemeral message to the user if able, if not, DMs the user
export async function informUser(slackId: string, message: string, channel: string, thread_ts: undefined | string = undefined) {
    const result = await app.client.chat.postEphemeral({
        user: slackId,
        channel,
        text: message,
        thread_ts        
    });

    if (!result.ok) {
        // If the error is due to access permissions, just dm the user
        if (result.error === 'not_in_channel') { 
            await app.client.chat.postMessage({
                channel: slackId,
                thread_ts,
                text: message
            });
        } else {
            throw new Error(`Error sending message: ${result.error}`);
        }
    }
}

export async function cancelSession(slackId: string, session: Session) {
    const updatedSession = await prisma.session.update({
        where: {
            messageTs: session.messageTs
        },
        data: {
            cancelled: true
        }
    });
    
    await app.client.chat.postMessage({
        thread_ts: updatedSession.messageTs,
        channel: Environment.MAIN_CHANNEL,
        text: t(`cancel`, {
            slackId
        })
    });

    await updateController(updatedSession);
}