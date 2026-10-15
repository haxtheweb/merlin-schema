// Fixture for `validate.js --scan`: one valid registration, one valid
// program row, and two mistakes. Not real code.
import { SuperDaemonInstance } from "@haxtheweb/super-daemon/super-daemon.js";

export class Example extends HTMLElement {
  static get properties() {
    // Lit property declarations must not be mistaken for options
    return { title: { type: String }, eventName: { type: String }, value: { type: Object } };
  }
  connectedCallback() {
    SuperDaemonInstance.defineOption({
      title: this.t.save,
      icon: "icons:save",
      tags: ["CMS", "save"],
      shortcut: "cms-save",
      context: ["HAX"],
      eventName: "super-daemon-element-method",
      path: "CMS/action/save",
      value: { target: this, method: "_save" },
    });
    SuperDaemonInstance.defineOption({
      title: "Edit tags",
      icon: "icons:label",
      tag: ["CMS"],
      context: ["CMS"],
      eventName: "super-daemon-run-program",
      path: "CMS/edit/tags",
      value: {
        name: "Edit tags",
        context: ["CMS"],
        program: async (input) => [
          {
            title: `Save tags: ${input}`,
            icon: "icons:check",
            tags: ["confirm"],
            eventName: "super-daemon-element-method",
            path: "CMS/edit/tags/confirm",
            value: { target: globalThis, method: "dispatchEvent", args: [] },
          },
        ],
      },
    });
  }
}
