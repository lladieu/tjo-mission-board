# Jedi Order Mission Terminal

A Star Wars Old Republic roleplay mission board designed around the **Jedi Order**, with a military-command + holographic terminal aesthetic.

## What is included

- Jedi Order Mission Terminal homepage
- High-risk operations displayed first
- Warfront Operations and Jedi Operations
- Your requested Warfront mission types:
  - Assault
  - Defense
  - Recon
  - Sabotage
  - Intelligence
  - Supply
  - Aid
  - Escort
  - Search & Rescue
  - Elimination
  - Special Operations
- Your requested Jedi mission types:
  - Artifact Recovery
  - Diplomacy
  - Research
  - Recon
  - Temple Operations
  - Support
  - Investigation
  - Exploration
  - Judicial
  - Special Operations
- Mission fields:
  - Mission name
  - Location
  - Type
  - Threat level
  - Required personnel
  - Jedi lead
  - Date/time
  - Briefing
  - Official result/archive summary
- Player assignment requests requiring Command Staff approval
- Visible mission rosters
- Player withdrawal of requests
- Mission capacity enforcement
- In-app notifications
- Mission archive/history
- Jedi service records
- Discord authentication
- Player / Command Staff / Super Admin roles
- Command dashboard for missions, applications, personnel, announcements, and terminal settings
- Responsive layout for desktop and mobile
- Demo mode so the interface can be tested before connecting a database

## Recommended free architecture

**Frontend:** GitHub Pages  
**Database + authentication:** Supabase  
**Login:** Discord OAuth through Supabase  

GitHub Pages can publish static HTML/CSS/JavaScript directly from a repository. Supabase's Free plan currently includes social OAuth, 50,000 monthly active users, a 500 MB database, and 1 GB file storage. Supabase free projects can pause after a week of inactivity, so a very low-traffic RP board may occasionally need to be opened/woken back up. See the official documentation before deployment.

## Files

- `index.html` — page structure
- `styles.css` — holographic Jedi/military visual design
- `app.js` — interface, demo mode, authentication, mission management, rosters, service records, notifications
- `schema.sql` — Supabase database schema, RLS security policies, triggers, and notification logic
- `config.example.js` — configuration template
- `config.js` — local blank configuration; fill this in when the Supabase project exists
- `.nojekyll` — prevents GitHub Pages from trying to process the static site

## 1. Create the Supabase project

Create a free Supabase project and open its SQL Editor.

Run **all of `schema.sql`**.

The schema creates the following tables:

- `profiles`
- `missions`
- `mission_applications`
- `notifications`
- `announcements`

It also enables Row Level Security so normal players cannot create/edit/delete missions or change other people's records.

## 2. Configure Discord login

In Discord Developer Portal:

1. Create a new Discord application.
2. Open OAuth2 settings.
3. Supabase will provide a callback URL in its Discord provider settings. Copy that callback URL into Discord's redirect list.
4. Copy the Discord Client ID and Client Secret into Supabase's Authentication → Providers → Discord settings.
5. Enable Discord.

Do **not** put the Discord Client Secret in this website's JavaScript.

## 3. Configure Supabase URLs

In Supabase Authentication URL Configuration:

- Set the Site URL to your final GitHub Pages URL.
- Add the same URL to the Redirect URLs / allow list if required.

For a GitHub project site, the address will look similar to:

`https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/`

## 4. Fill in config.js

Copy the values from your Supabase project's API settings into `config.js`:

```js
window.MISSION_BOARD_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabaseAnonKey: 'YOUR-SUPABASE-ANON-KEY'
};
```

The Supabase **anon/publishable key is designed to be used by a browser application**. The database's Row Level Security policies are what protect the data.

Never place a Supabase service-role key or Discord Client Secret in this file.

## 5. Create the first Super Admin

1. Open the finished site.
2. Sign in with Discord once.
3. Supabase will create your `profiles` row automatically.
4. Open Supabase → Table Editor → `profiles`.
5. Copy your user's `id`.
6. Run:

```sql
update public.profiles
set role = 'super_admin'
where id = 'YOUR-AUTH-USER-UUID';
```

After refreshing the website, the **COMMAND** administration interface will appear.

## 6. Put the site on GitHub Pages

1. Create a GitHub account if needed.
2. Create a repository for this project.
3. Upload the project files.
4. Make sure `index.html` is in the repository root.
5. In the repository, open Settings → Pages.
6. Select the branch containing the website and the root folder as the publishing source.
7. Save.
8. GitHub will give you the live `github.io` address.
9. Put that address into the Supabase authentication URL settings.

## Security model

Players can:

- Sign in with Discord
- Complete/edit their own personnel record
- View missions
- View approved rosters
- Request assignment
- Withdraw their own request
- View their service record
- Receive notifications

Command Staff can additionally:

- Create missions
- Edit missions
- Delete missions
- Change mission status
- Record mission results
- Approve/decline/remove assignments
- Maintain personnel records
- Publish command bulletins

Super Admins can additionally:

- Change account roles

The database enforces these permissions with Supabase Row Level Security. The frontend hiding a button is **not** treated as a security boundary.

## Demo mode

If `config.js` has blank Supabase values, the site automatically launches in demo mode.

The demo account is a Command Staff account, so you can explore the administrative interface and see the complete visual system without creating accounts or a database first.

Demo changes are stored only in the browser session and are not permanent.

## Suggested next phase

Once the live version is connected, the next improvements I would make are:

1. Add your exact Jedi ranks/pathways/classes as controlled choices.
2. Add your official Jedi Order insignia/branding if you have one.
3. Add a dedicated archive page with completed mission records.
4. Add richer mission outcome records.
5. Add optional Discord notifications later if your community decides it needs them.
6. Add your community's exact terminology for Command Staff and mission approval.


## Command Directory

Command Staff now have a **DIRECTORY** tab under Administration. It manages:
- Warfront Operations mission subcategories
- Jedi Operations mission subcategories
- The planetary roster used by mission creation

Subcategories can be added, renamed, or removed. Planets can be added or removed. The live Supabase schema includes `mission_types` and `planets` tables plus Command Staff RLS policies. Existing active missions prevent removal of a subcategory or planet when the roster item is in use.

## v9 moderation upgrade
Run `upgrade-v9.sql` once in Supabase SQL Editor. Then upload the v9 `index.html` to the root of the existing GitHub Pages repository. The Owner gets Administration -> NAME FILTER. The database rejects prohibited Character Name, Roblox User, and Discord User values even if a user bypasses the frontend.

## v10 upgrade
Run `upgrade-v10.sql` once in Supabase SQL Editor, then replace the live GitHub `index.html` with this version. v10 adds the Bulletin, Mission Board, and Service Records top-level tabs; announcements automatically create notifications for every player; and Service Records ranks personnel by approved mission participation.
