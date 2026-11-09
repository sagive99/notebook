# iPhone Reminders setup

Notebook can put every "Calendar + reminder" item into the iPhone **Reminders** app as well as Google Calendar. A web app can't write to Reminders, so it hands each reminder to a Shortcut you build once ([ADR 0007](../adr/0007-iphone-reminders-via-shortcut.md)).

## 1. Build the shortcut

In the **Shortcuts** app, tap **+** and name the shortcut exactly **Notebook Reminder**. Add these actions in order. Names are the English ones; on a Hebrew iPhone, search for the same action by meaning.

1. **Get Dictionary from Input**, with input set to **Shortcut Input**.
2. **Get Dictionary Value**: key `tag`, from Dictionary.
3. **Find Reminders**: add the filter **Notes contains**, then insert the Dictionary Value from step 2 into it.
4. **If** Reminders **has any value**. Inside it, add **Remove Reminders** with Reminders. This replaces the old copy when you edit an item. If iOS asks to confirm deletions, allow it.
5. After **End If**: **Get Dictionary Value**: key `action`, from Dictionary.
6. **If** Dictionary Value **is** `add`. Inside it:
   1. **Get Dictionary Value**: key `title`, from Dictionary.
   2. **Get Dictionary Value**: key `due`, from Dictionary.
   3. **Get Dates from Input** with the `due` value.
   4. **Add New Reminder** with the `title` value. Choose your list, turn on **Remind Me** → **At Time**, and set the time to Dates. Under **Notes**, insert the `tag` value from step 2.

## 2. Turn it on in Notebook

Go to Customize Today → **iPhone Reminders** → **Also add to the Reminders app**. Then tap **Test**. The Shortcuts app opens and adds "Notebook test reminder" two minutes ahead. The first time, iOS asks whether Notebook may open Shortcuts; allow it. Delete the test reminder afterwards.

## How it behaves

- **Saving an item:** when you save one with Calendar + reminder on (or change its text, day or time), Shortcuts opens for a moment. Tap **‹ Notebook** at the top left to come back. Saving without a change doesn't open it.
- **Turning a reminder off or deleting an item:** doing this from the Edit sheet removes the reminder.
- **One-way:** ticking a reminder in Reminders doesn't tick the task, and ticking the task doesn't remove the reminder.
- **No time:** an item with a day but no time gets an 08:30 alert.
- **Per phone:** the setting is per phone and doesn't sync.
