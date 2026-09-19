/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs.
 * @param {object} [options={}]
 * @param {boolean} [options.bypassVersionCheck=false]  Bypass certain migration restrictions gated behind system
 *                                                      version stored in item stats.
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export async function migrateWorld({ bypassVersionCheck = false } = {}) {
  const currentVersion = game.settings.get("Pendragon", "systemMigrationVersion");
  const targetVersion = game.system.version;
  console.log(`Migrate from ${currentVersion} to ${targetVersion}`);

  //Migrate if current system is less that Version 12.1.21
  if (foundry.utils.isNewerVersion("12.1.21", currentVersion ?? "0")) {
    const actors = game.actors.map((a) => a);
    for (const actor of actors) {
      const updateData = migrateActor(actor);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Actor document ${actor.name}`);
        await actor.update(updateData);
      }
    }
  }

  //Migrate if current system is less that Version 13.1.36
  if (foundry.utils.isNewerVersion("13.1.36", currentVersion ?? "0")) {
    await migrateItems_13136();
  }

  //Migrate if current system is less that Version 13.1.57
  if (foundry.utils.isNewerVersion("13.1.57", currentVersion ?? "0")) {
    await honorUpdate();
  }

  //Migrate if current system is less that Version 13.1.58
  if (foundry.utils.isNewerVersion("13.1.58", currentVersion ?? "0")) {
    await classIdealUpdate();
  }

  //Migrate if current system is less that Version 14.5
  if (foundry.utils.isNewerVersion("14.5", currentVersion ?? "0")) {
    await gameTimeUpdate();
  }

  //Migrate if current system is less that Version 14.17
  if (foundry.utils.isNewerVersion("14.17", currentVersion ?? "0")) {
    //Repeat some checks on each updates
    //Encounter and Battle migrations
    console.log("Migration to 14.17 started");
    const updates = await getUpdatesFor(game.actors);
    if (updates.length) {
      await Actor.updateDocuments(updates);
    }

    for (const pack of game.packs) {
      if (!_shouldMigrateCompendium(pack)) {
        continue;
      }
      if (pack.metadata.type === "Actor") {
        const documents = await pack.getDocuments();
        const updates = await getUpdatesFor(documents);
        if (updates.length) {
          const wasLocked = pack.locked;
          if (wasLocked) {
            await pack.configure({ locked: false });
          }
          await Actor.updateDocuments(updates, { pack: pack.metadata.id });
          if (wasLocked) {
            await pack.configure({ locked: true });
          }
        }
      }
    }
    console.log("Migration to 14.17 completed");
  }

  //Migrate if current system is less that Version 14.19
  if (foundry.utils.isNewerVersion("14.19", currentVersion ?? "0")) {
    await equippedHandsUpdate();
  }

  await game.settings.set("Pendragon", "systemMigrationVersion", targetVersion);
  return;
}

//Populate equippedHands from existing shield and currentWeapon data
export async function equippedHandsUpdate() {
  console.log("Migration to 14.19 started");
  for (const actor of game.actors) {
    if (!["character", "npc"].includes(actor.type)) continue;
    const updateData = equippedHandsUpdateData(actor);
    if (!foundry.utils.isEmpty(updateData)) {
      await actor.update(updateData);
    }
  }
  // Migrate Items in Scenes [Token] Actors
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (token.actorLink) continue;
      const actor = token.actor;
      if (!actor || !["character", "npc"].includes(actor.type)) continue;
      const updateData = equippedHandsUpdateData(actor);
      if (!foundry.utils.isEmpty(updateData)) {
        await actor.update(updateData);
      }
    }
  }
  console.log("Migration to 14.19 completed");
}

//populate equippedHands from existing shield and currentWeapon data, and give every weapon
//its own wield state to match the hands it can be found in
function equippedHandsUpdateData(actor) {
  const hands = { primary: "", secondary: "" };
  const shield = actor.items.find((i) => i.type === "armour" && i.system.equipped && !i.system.type);
  if (shield) {
    hands.secondary = shield.id;
  }
  const weapon = actor.currentWeapon();
  if (weapon) {
    hands.primary = weapon.id;
    if (weapon.system.twoHandedOnly) {
      //an equipped shield keeps the secondary hand (the weapon is then wielded one-handed); without a shield it takes both
      if (!(shield && weapon.system.skill === "charge")) {
        hands.secondary = weapon.id;
      }
    }
  }
  const current = actor.system.equippedHands ?? {};
  const updateData = {};
  if (current.primary !== hands.primary || current.secondary !== hands.secondary) {
    updateData["system.equippedHands.primary"] = hands.primary;
    updateData["system.equippedHands.secondary"] = hands.secondary;
  }
  //a weapon left in no hand is carried (sheathed or at the side)
  const items = [];
  for (const item of actor.items) {
    if (item.type !== "weapon") continue;
    const inPrimary = hands.primary === item.id;
    const inSecondary = hands.secondary === item.id;
    let wield = "carried";
    if (inPrimary && inSecondary) wield = "twoHanded";
    else if (inPrimary || inSecondary) wield = "primaryHand";
    if (wield !== item.system.wield) items.push({ _id: item.id, "system.wield": wield });
  }
  if (items.length) updateData.items = items;
  return updateData;
}

//------------------------------------------------------------------------------------------
//Update for version 12.1.21
export async function migrateActor_12121(actor) {
  const updateData = {};

  // migrate Owned items
  const items = actor.items.reduce((arr, i) => {
    // Migrate the Owned Item
    const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
    const itemUpdate = migrateItemData_12121(i, itemData);
    if (!foundry.utils.isEmpty(itemUpdate)) {
      arr.push({ ...itemUpdate, _id: itemData._id });
    }
    return arr;
  }, []);

  if (items.length > 0) updateData.items = items;
  return updateData;
}

export async function migrateItemData_12121(item, itemData) {
  const updateData = {};
  if (itemData.type === "history" && itemData.name === "History") {
    if (itemData.system.description) {
      updateData["name"] = itemData.system.description.replace(/(<([^>]+)>)/gi, "");
    }
  }
  return updateData;
}

//------------------------------------------------------------------------------------------
//Update for version 13.1.36
export async function migrateItems_13136() {
  console.log("Migration to 13.1.36");
  const updateData = {};
  // Migrate World Items
  const items = game.items.filter((itm) => itm.type === "skill");
  for (let item of items) {
    await migrateItemData_13136(item);
  }

  //Migrate Actor Items
  for (let actor of game.actors) {
    const actoritems = actor.items.filter((itm) => itm.type === "skill");
    for (let item of actoritems) {
      await migrateItemData_13136(item);
    }
  }

  // Migrate Items in Scenes [Token] Actors
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (token.actorLink) {
        continue;
      }
      let tokenitems = token.delta.items.filter((itm) => itm.type === "skill");
      for (let item of tokenitems) {
        await migrateItemData_13136(item);
      }
    }
  }

  //Migrate Compendium Packs
  for (const pack of game.packs) {
    if (!_shouldMigrateCompendium(pack)) {
      continue;
    }
    // Unlock the pack for editing
    const wasLocked = pack.locked;
    await pack.configure({ locked: false });
    // Begin by requesting server-side data model migration and get the migrated content
    const documents = await pack.getDocuments();
    for (let doc of documents) {
      switch (pack.documentName) {
        case "Actor":
          break;
        case "Item":
          await migrateItemData_13136(doc);
          break;
        case "Scene":
          break;
      }
    }
    await pack.configure({ locked: wasLocked });
  }
}

//------------------------------------------------------------------------------------------
export async function migrateItemData_13136(item) {
  //If categories already set then don't migrate
  if ((item.system.categories ?? []).length > 0) {
    return;
  }
  const updateData = [];
  if (item.system.combat) {
    updateData.push("combat");
  }
  if (item.system.nonknightly) {
    updateData.push("nonknightly");
  }
  await item.update({ "system.categories": updateData });
  return;
}

/**
 * Determine whether a compendium pack should be migrated during `migrateWorld`.
 * @param {Compendium} pack
 * @returns {boolean}
 */
function _shouldMigrateCompendium(pack) {
  // We only care about actor, item or scene migrations
  if (!["Actor", "Item", "Scene"].includes(pack.documentName)) return false;

  // World compendiums should all be migrated, system ones should never by migrated
  if (pack.metadata.packageType === "world") return true;
  if (pack.metadata.packageType === "system") return false;

  // Module compendiums should only be migrated if they don't have a download or manifest URL
  const module = game.modules.get(pack.metadata.packageName);
  return !module.download && !module.manifest;
}

export async function honorUpdate() {
  console.log("Migration to 13.1.57 started");
  //Update World Items
  for (let item of game.items) {
    if (item.type != "passion") {
      continue;
    }
    if (item.flags.Pendragon?.pidFlag?.id === "i.passion.honour") {
      await item.update({ "flags.Pendragon.pidFlag.id": "i.passion.honor" });
    }
  }

  //Update Items in World Actors
  for (let actor of game.actors) {
    for (let item of actor.items) {
      if (item.type != "passion") {
        continue;
      }
      if (item.flags.Pendragon?.pidFlag?.id === "i.passion.honour") {
        await item.update({ "flags.Pendragon.pidFlag.id": "i.passion.honor" });
      }
    }
  }

  // Update Items in  Scenes [Token] Actors
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (token.actorLink) {
        continue;
      }
      for (let item of token.delta.items) {
        if (item.type != "passion") {
          continue;
        }
        if (item.flags.Pendragon?.pidFlag?.id === "i.passion.honour") {
          await item.update({ "flags.Pendragon.pidFlag.id": "i.passion.honor" });
        }
      }
    }
    return;
  }

  //Migrate Compendium Packs
  for (const pack of game.packs) {
    if (!_shouldMigrateCompendium(pack)) {
      continue;
    }
    // Unlock the pack for editing
    const wasLocked = pack.locked;
    await pack.configure({ locked: false });
    // Begin by requesting server-side data model migration and get the migrated content
    const documents = await pack.getDocuments();
    for (let doc of documents) {
      switch (pack.documentName) {
        case "Actor":
          for (let item of doc.items) {
            if (item.type != "passion") {
              continue;
            }
            if (item.flags.Pendragon?.pidFlag?.id === "i.passion.honour") {
              await item.update({ "flags.Pendragon.pidFlag.id": "i.passion.honor" });
            }
          }
        case "Item":
          if (doc.type === "passion") {
            if (doc.flags.Pendragon?.pidFlag?.id === "i.passion.honour") {
              await doc.update({ "flags.Pendragon.pidFlag.id": "i.passion.honor" });
            }
          }
          break;
        case "Scene":
          break;
      }
    }
    await pack.configure({ locked: wasLocked });
  }
  console.log("Migration to 13.1.57 completed");
}

//------------------------------------------------------------------------------------------
export async function classIdealUpdate() {
  console.log("Migration to 13.1.58 started");
  //Update World Items
  for (let item of game.items) {
    if (item.type === "class") {
      let newPassions = [];
      const coll = item.system.passions ?? [];
      for (let passion of coll) {
        if (passion.pid === "i.passion.honour") {
          passion.pid = "i.passion.honor";
        }
        newPassions.push(passion);
      }
      await item.update({ "system.passions": newPassions });
    } else if (item.type === "ideal") {
      let newPassions = [];
      const coll = item.system.require ?? [];
      for (let passion of coll) {
        if (passion.pid === "i.passion.honour") {
          passion.pid = "i.passion.honor";
        }
        newPassions.push(passion);
      }
      await item.update({ "system.require": newPassions });
    }
  }

  //Migrate Compendium Packs
  for (const pack of game.packs) {
    if (!_shouldMigrateCompendium(pack)) {
      continue;
    }
    // Unlock the pack for editing
    const wasLocked = pack.locked;
    await pack.configure({ locked: false });
    // Begin by requesting server-side data model migration and get the migrated content
    const documents = await pack.getDocuments();
    for (let doc of documents) {
      switch (pack.documentName) {
        case "Actor":
          break;
        case "Item":
          if (doc.type === "class") {
            let newPassions = [];
            const coll = doc.system.passions ?? [];
            for (let passion of coll) {
              if (passion.pid === "i.passion.honour") {
                passion.pid = "i.passion.honor";
              }
              newPassions.push(passion);
            }
            await doc.update({ "system.passions": newPassions });
          } else if (doc.type === "ideal") {
            let newPassions = [];
            const coll = doc.system.require ?? [];
            for (let passion of coll) {
              if (passion.pid === "i.passion.honour") {
                passion.pid = "i.passion.honor";
              }
              newPassions.push(passion);
            }
            await doc.update({ "system.require": newPassions });
          }
          break;
        case "Scene":
          break;
      }
      await pack.configure({ locked: wasLocked });
    }
  }
  console.log("Migration to 13.1.58 completed");
}

//------------------------------------------------------------------------------------------
export async function gameTimeUpdate() {
  console.log("Migration to 14.5 started");

  let year = game.settings.get("Pendragon", "gameYear");
  await game.time.set({ year: year });
  await game.Pendragon.ui?.calendar.render({ force: true });
  return;
}

//------------------------------------------------------------------------------------------
//Update Encounters for 14.17
export async function getUpdatesFor(source) {
  const updates = [];
  for (const actor of source) {
    if (actor.type === "encounter") {
      let changed = false;
      const npcs = [];
      for (const npc of actor.system.npcs) {
        if (npc.migrateRequired) {
          let tempActor = await fromUuid(npc.uuid);
          if (tempActor) {
            let newName = npc.name ?? "";
            let newPid = npc.pid;
            if (newName === "") newName = tempActor.name;
            if (newPID === "") newPID = tempActor.flags?.Pendragon?.pidFlag?.id ?? "";
            npcs.push({
              name: newName,
              pid: newPID,
              uuid: npc.uuid,
            });
            changed = true;
          } else {
            npcs.push(npc);
          }
        } else {
          npcs.push(npc);
        }
      }
      if (changed) {
        updates.push({
          _id: actor.id,
          "system.npcs": npcs,
        });
      }
    }
    if (actor.type === "battle") {
      let changed = false;
      const encounters = [];
      for (const encounter of actor.system.encounters) {
        if (encounter.migrateRequired) {
          let tempActor = await fromUuid(encounter.uuid);
          if (tempActor) {
            let newName = encounter.name ?? "";
            let newPid = encounter.pid;
            if (newName === "") newName = tempActor.name;
            if (newPID === "") newPID = tempActor.flags?.Pendragon?.pidFlag?.id ?? "";
            encounters.push({
              name: newName,
              pid: newPID,
              uuid: encounter.uuid,
            });
            changed = true;
          } else {
            encounters.push(encounter);
          }
        } else {
          encounters.push(encounter);
        }
      }
      if (changed) {
        updates.push({
          _id: actor.id,
          "system.encounters": encounters,
        });
      }
    }
  }
  return updates;
}
