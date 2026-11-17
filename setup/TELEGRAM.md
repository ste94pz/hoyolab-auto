# Telegram

This is an **OPTIONAL** feature. If you want to receive a Telegram notification
when the check-in is successful and any other features that you have enabled,
you can create a Telegram bot and paste the value into the `config.json5` file.

1. Go to [@BotFather](https://t.me/BotFather) and type `/newbot`.
2. Create a name for your bot
    - Such as `HoyoLab`
3. Create a username for your bot. (Must end with `bot` or `_bot`)
    - Such as `HoyoLabBot` or `HoyoLab_bot`
4. If all goes well, you should receive a message that will look like this:

    ```text
    Done! Congratulations on your new bot. You will find it at t.me/HoyoLabBot. You can now add a description, about section and profile picture for your bot, see /help for a list of commands. By the way, when you've finished creating your cool bot, ping our Bot Support if you want a better username for it. Just make sure the bot is fully operational before you do this.
    ```

5. On the same message, you will see a `token` that looks like this:

    ```text
    123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
    ```

6. Paste the `token` into the `token` Telegram  field at the `config.json5`
   file.
7. Next you need to get your `chatId`. You can send a message to
   [@getmyid_bot](https://t.me/getmyid_bot) and it will reply with your
   `chatId`.
8. You will receive a message that will look like this:

    ```text
    Your user ID: 123456789
    ```

9. Paste your user ID into the `chatId` Telegram field at the `config.json5`
   file.
10. You should receive a Telegram notification when the check-in is successful
    and any other features that you have enabled.

## Polling and errors

Each bot token should be used by only one running bot instance. Updates are polled
five seconds after the previous poll completes, with no overlapping requests.
Failures are logged and retried with increasing delays, up to one minute;
Telegram's `retry_after` can extend that delay. Conflicts (HTTP 409) wait at least
30 seconds. Successful polls restore the normal interval. Interactive code
redemption continues polling while waiting for your reply.

HTTP diagnostics redact Telegram bot tokens, Discord webhook tokens, URL login
credentials, query values, and fragments. Existing log files are not rewritten;
if an older log exposed your bot token, revoke it through @BotFather and update
your configuration.

## Screenshots

Here are some screenshots of the bot in action:

- Stamina Reminder

![image](https://github.com/user-attachments/assets/df403ce3-cf5c-4362-9374-305aa586cf87)

- Notes

![image](https://github.com/user-attachments/assets/465dc4e5-973c-4ca7-a97f-f903ce1e955f)

- Stamina

![image](https://github.com/user-attachments/assets/ce8730cd-25fe-45c4-bb4d-898267df4921)

- Check-in

![image](https://github.com/user-attachments/assets/982a9bbd-0669-4e3e-a5d6-3c5867bfc050)

## Commands

Here's a list of commands that you can use with the bot:

- `/expedition` - Show the current expedition status
- `/notes` - Shows your current in-game notes
- `/stamina` - Shows your current stamina
- `/redeem` - Redeem a code redemption
