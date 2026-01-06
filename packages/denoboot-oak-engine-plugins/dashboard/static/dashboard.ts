// dashboard.ts
export class Dashboard {
  private root: Document;

  constructor(root: Document) {
    this.root = root;
  }

  init() {
    console.log("Dashboard initialized");

    this.root
      .querySelector('[data-action="hello"]')
      ?.addEventListener('click', () => this.helloWorld());
  }

  helloWorld() {
    Promise.resolve().then(() => { // <- Hot time | prevent dom violatins, for example "[Violation] 'click' handler took 721ms"
      alert("Hello World");
    });
  }
}
