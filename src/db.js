export function openDataBase(
  dataBaseName,
  version = 1,
  storeName = "common_table",
  indexKeys = []
) {
  return new Promise((res, rej) => {
    const request = window.indexedDB.open(dataBaseName, version);

    request.onerror = rej;
    request.onsuccess = () => {
      console.log("success");
      res(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log("upgrade -> ", event);
      // 创建表
      if (event.oldVersion === 0 || event.oldVersion !== version) {
        const objectStore = db.createObjectStore(storeName, {
          keyPath: "id",
          autoIncrement: true,
        });

        // 在创建表的时候同时创建索引
        indexKeys.forEach((item) => {
          const name =
            typeof item === "object" && item.name ? item.name : item.toString();
          const path =
            typeof item === "object" && item.type ? item.type : item.toString();

          const opt = item.opt ? item.opt : {};

          objectStore.createIndex(name, path, opt);
        });
      }
    };
  });
}

export function add(db, storeName, data) {
  // 这里可以和传入一个
  const tx = db.transaction(storeName, "readwrite");
  const request = tx.objectStore(storeName).add(data);

  return new Promise((res, rej) => {
    request.onsuccess = () => res(true);
    request.onerror = () => rej();
  });
}

export function read(db, storeName, id) {
  const tx = db.transaction(storeName);
  const objectStore = tx.objectStore(storeName);
  const request = id ? objectStore.get(id) : objectStore.getAll();

  return new Promise((res, rej) => {
    request.onsuccess = () => {
      if (request.result) {
        res(request.result);
      } else {
        res(id ? {} : []);
      }
    };

    request.onerror = rej;
  });
}

export function update(db, storeName, data) {
  const tx = db.transaction(storeName, "readwrite");
  const objectStore = tx.objectStore(storeName);
  const request = objectStore.put(data);

  return new Promise((res, rej) => {
    request.onsuccess = () => {
      res(request.result);
    };

    request.onerror = rej;
  });
}

export function remove(db, storeName, id) {
  const objectStore = db
    .transaction(storeName, "readwrite")
    .objectStore(storeName);

  const request = objectStore.delete(id);

  return new Promise((res, rej) => {
    request.onsuccess = () => {
      res(true);
    };

    request.onerror = rej;
  });
}

export function queryByIndex(db, storeName, searchIndex, value) {
  const store = db.transaction(storeName).objectStore(storeName);
  const index = store.index(searchIndex);
  const request = index.get(value);

  return new Promise((res, rej) => {
    request.onsuccess = () => {
      res(request.result);
    };

    request.onerror = rej;
  });
}
