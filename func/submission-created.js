const fetch = require("node-fetch");

const { API_ENDPOINT, MAX_EMBED_FIELD_CHARS } = require("./helpers/discord-helpers.js");
const { createJwt, decodeJwt } = require("./helpers/jwt-helpers.js");

exports.handler = async function (event, context) {
    let payload;

    if (process.env.USE_NETLIFY_FORMS) {
        payload = JSON.parse(event.body).payload.data;
    } else {
        if (event.httpMethod !== "POST") {
            return {
                statusCode: 405
            };
        }

        const params = new URLSearchParams(event.body);
        payload = {
            Name: params.get("Name") || undefined,
            banned: params.get("banned") || undefined,
            Unban: params.get("Unban") || undefined,
            futureActions: params.get("futureActions") || undefined,
            DiscordName: params.get("DiscordName") || undefined,
            token: params.get("token") || undefined
        };
    }

    if (payload.Name !== undefined &&
        payload.banned !== undefined &&
        payload.unban !== undefined && 
        payload.futureActions !== undefined && 
        payload.DiscordName !== undefined && 
        payload.token !== undefined) {
        
        const userInfo = decodeJwt(payload.token);
        const embedFields = [
            {
                name: "Submitter",
                value: `<@${userInfo.id}> (${userInfo.username}#${userInfo.discriminator})`
            },
            {
                name: "What's Your Name",
                value: payload.Name.slice(0, MAX_EMBED_FIELD_CHARS)
            },
            {
                name: "Why Were You Banned",
                value: payload.banned.slice(0, MAX_EMBED_FIELD_CHARS)
            },
            {
                name: "Why Should We Unban You",
                value: payload.Unban.slice(0, MAX_EMBED_FIELD_CHARS)
            },
            {
                name: "What will you do to avoid being banned in the future?",
                value: payload.futureActions.slice(0, MAX_EMBED_FIELD_CHARS)
            },
            {
                name: "What Is Your Discord Name",
                value: payload.DiscordName.slice(0, MAX_EMBED_FIELD_CHARS)
            }
        ];

        if (process.env.GUILD_ID && !process.env.DISABLE_UNBAN_LINK) {
            const unbanUrl = new URL("/.netlify/functions/unban", process.env.URL);
            const unbanInfo = {
                userId: userInfo.id
            };

            embedFields.push({
                name: "Actions",
                value: `[Approve appeal and unban user](${unbanUrl.toString()}?token=${encodeURIComponent(createJwt(unbanInfo))})`
            });
        }

        const result = await fetch(`${API_ENDPOINT}/channels/${encodeURIComponent(process.env.APPEALS_CHANNEL)}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`
            },
            body: JSON.stringify({
                embed: {
                    title: "New appeal submitted!",
                    timestamp: new Date().toISOString(),
                    fields: embedFields
                }
            })
        });

        if (result.ok) {
            if (process.env.USE_NETLIFY_FORMS) {
                return {
                    statusCode: 200
                };
            } else {
                return {
                    statusCode: 303,
                    headers: {
                        "Location": "/success"
                    }
                };
            }
        } else {
            console.log(await result.json());
            throw new Error("Failed to submit message");
        }
    }

    return {
        statusCode: 400
    };
}