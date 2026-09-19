const { HTMLField, SchemaField, NumberField, StringField, FilePathField, ArrayField, BooleanField, DataField } =
  foundry.data.fields;

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    return {
      source: new StringField({ initial: "" }),
      description: new StringField({ required: true, blank: true, initial: "" }),
      GMdescription: new StringField({ required: true, blank: true, initial: "" }),
      mounted: new StringField({ required: true, blank: true, initial: "both" }),
      skill: new StringField({ required: true, blank: true, initial: "" }),
      damageRoll: new StringField({ required: true, blank: true, initial: "" }),
      damageChar: new StringField({ required: true, blank: true, initial: "c" }),
      dmgForm: new StringField({ required: true, blank: true, initial: "" }),
      advantage: new StringField({ required: true, blank: true, initial: "" }),
      disadvantage: new StringField({ required: true, blank: true, initial: "" }),
      range: new StringField({ required: true, blank: true, initial: "" }),
      rate: new StringField({ required: true, blank: true, initial: "1" }),
      //wield state of this weapon: carried (sheathed/at side), dropped (on the ground),
      //primaryHand (one hand) or twoHanded (both hands)
      wield: new StringField({ required: true, blank: true, initial: "carried" }),
      melee: new BooleanField({ initial: true }),
      improv: new BooleanField({ initial: false }),
      special: new BooleanField({ initial: false }),
      quantity: new NumberField({ ...requiredInteger, initial: 1 }),
      value: new NumberField({ ...requiredInteger, initial: 0 }),
      damageMax: new NumberField({ ...requiredInteger, initial: 99 }),
      damageMod: new NumberField({ ...requiredInteger, initial: 0 }),
      damageBonus: new NumberField({ ...requiredInteger, initial: 0 }),
      unarmoured: new NumberField({ ...requiredInteger, initial: 0 }),
      mail: new NumberField({ ...requiredInteger, initial: 0 }),
      plate: new NumberField({ ...requiredInteger, initial: 0 }),
      parry: new NumberField({ ...requiredInteger, initial: 0 }),
      libra: new NumberField({ ...requiredInteger, min: 0, initial: 0 }),
      denarii: new NumberField({ ...requiredInteger, min: 0, initial: 0 }),
      yearAvailable: new NumberField({ ...requiredInteger, initial: 0 }),
    };
  }

  get usableMounted() {
    return this.mounted == "mounted" || this.mounted == "both";
  }
  get canCharge() {
    return this.usableMounted && this.damageChar != "b" && this.skill != "brawling";
  }
  //spear can optionally be wielded two-handed; twoHand (Two-Handed Hafted) and charge (lances) are inherently two-handed
  // TODO: sword can be wielded in 2 hands with *no* damage bonus and a GM-optional rule to avoid drops on fumbles, but that's not in scope for now.
  get canBeTwoHanded() {
    return ["spear", "twoHand", "charge"].includes(this.skill);
  }
  get twoHandedOnly() {
    return ["twoHand", "charge"].includes(this.skill);
  }
}
