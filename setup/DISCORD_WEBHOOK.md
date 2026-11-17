# Discord Webhooks

This is an **OPTIONAL** feature. If you want to receive a Discord notification
when the check-in is successful or any other features that you have enabled, you
can create a Discord webhook and paste the value into the `config.json5` file.

1. Go to edit channel settings. (Create your own server if you don't have one.)

   ![Channel settings](https://i.imgur.com/FWfK3My.png)

2. Go to the "Integrations" tab and click on "Create Webhook".

   ![Integrations tab and Create Webhook
   button](https://i.imgur.com/DnELZJl.png)

3. Create a name for your webhook and click on "Copy Webhook URL".

   ![Webhook name and Copy Webhook URL button](https://i.imgur.com/AkfTTBB.png)

4. Click on "Save Changes".

   ![Save Changes button](https://i.imgur.com/KFYeonU.png)

5. Paste the URL into the `webhook > url` field at the `default.config.json5` or
   `config.json5` file.

   ![Webhook URL
configuration](https://github.com/torikushiii/hoyolab-auto/assets/21153445/ed9960b4-447e-450a-860e-ae49b0610bcf)

   - And it would look like this

   ```json
   {
       "webhook": {
            id: 3,
            active: true, // Remember to set this to true
            type: "webhook",
            url: "https://discord.com/api/webhooks/1234567890/ABCDEFGHIJKLMN1234567890"
       }
   }
   ```

6. You should receive a Discord notification when the check-in is successful.

   ![Successful check-in
notification](https://github.com/torikushiii/hoyolab-auto/assets/21153445/5c60a56a-f6ee-4d8e-b6ac-4b1df91866ae)

7. And if you enable stamina check or expedition check, you should receive a
   Discord notification when your stamina is above your set threshold or when
   your expedition is done.

   ![Stamina and expedition
notifications](https://github.com/torikushiii/hoyolab-auto/assets/21153445/a9a39b9a-e2aa-46ce-b8bc-ffce5341ada5)
