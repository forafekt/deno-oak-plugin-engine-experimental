// @denoboot/db/repository.ts

export function createRepository(model: any, db: any) {
  return {
    findAll(filter = {}) {
      return db.select(model.tableName, filter);
    },

    findById(id: string) {
      return db.selectOne(model.tableName, { id });
    },

    create(data: any) {
      return db.insert(model.tableName, data);
    },

    update(id: string, data: any) {
      return db.update(model.tableName, id, data);
    },

    delete(id: string) {
      return db.delete(model.tableName, id);
    },
  };
}
