# IndexedDB 初探

IndexDB存储的好处：

1. 存储空间大
2. 提供了查询接口（LocalStorage不支持查询）
3. 能够建立索引

## 一、IndexedDB的特点

+ 键值对存储（object store）。以JS任何数据解构存入都支持。目前需要保证**主键唯一**。目前都是通过主键进行查询的，类似NoSQL数据库。
+ 异步查询。查询时不会组测浏览器，LocalStorage操作是同步的，可能会阻塞页面。
+ 支持事务。事务失败可以让整个数据库进行回滚
+ 存储空间大。没有限制
+ 支持二进制存储。可以存ArrayBuffer和Blob对象
+ 同源策略。仅支持同域访问。



## 二、基本概念

+ 数据库：IDBDatabase 对象
  + 一个域名下存在多个数据库
  + 每个数据库存在版本的概念，对数据库进行修改（增删表、索引、主键）都需要升级数据库版本
+ 对象仓库：IDBObjectStore 对象
  + 对比就是关系型数据库中表的概念
+ 索引： IDBIndex 对象
+ 事务： IDBTransaction 对象
  + 用于表的读写和修改
  + 提供error，abort和complete三个事件来监听
+ 操作请求：IDBRequest 对象
+ 指针： IDBCursor 对象
+ 主键集合：IDBKeyRange 对象



## 三、操作流程

### 3.1 打开数据库

使用`indexedDB.open`来打开一个数据库，如果改数据库不存在的时候会新创建一个新的数据库。

```javascript
const request = window.indexedDB.open('pd-test', 1);
```

参数说明：第一个参数是数据库的名字，第二个是数据库的版本，默认为1。

返回值说明：执行结果中暴露出三个状态，供使用者来操作对应的执行结果：`error`、`success`

、`upgradeneeded`。

**（1）error**：表示数据库打开失败

**（2）success**：表示数据库打开成功，在success事件中，db是在request中的

**（3）upgradeneedeed**：版本号大于当前版本号就会发生数据库升级（比如没有数据库的时候，使用`open`api创建了一个新的数据库，那么这个时候版本号如果默认是1，这个时候就会发生升级），升级的db需要通过event中得到



在新建数据库的场景下，实测了一下其实`upgradeneedeed`事件是先于`success`事件的，因此我们这里可以封装一个OpenDataBase的这个方法。

```javascript
export function openDataBase(dataBaseName) {
  return new Promise((res, rej) => {
    const request = window.indexedDB.open(dataBaseName);

    request.onerror = rej;
    request.onsuccess = () => {
      // 通过request来获取对应的db
      res(request.result);
    };

    request.onupgradeneeded = (event) => {
      //  通过event.target.result获得升级后的db
      res(event.target.result);
    };
  });
}
```



### 3.2 新建仓库对象（表结构）

在生成了db之后，如果数据库不存在，会自动新创建数据库，这个时候我们需要新建仓库对象（关系型数据库中表的概念）在创建表结构的时候，我们同时可以创建索引，索引就是用于查询的时候可以提高查询效率，类似散列那样，查询效率更高。

因此我们将创建数据库的代码作如下修改，在`onupgradeneeded`中增加如下代码，通过`createObjectStore`这个api来创建新的Store。

**创建表的选项**：

- `IDBObjectStore.indexNames`：返回一个类似数组的对象（DOMStringList），包含了当前对象仓库的所有索引。
- `IDBObjectStore.keyPath`：返回当前对象仓库的主键。
- `IDBObjectStore.name`：返回当前对象仓库的名称。
- `IDBObjectStore.transaction`：返回当前对象仓库所属的事务对象。
- `IDBObjectStore.autoIncrement`：布尔值，表示主键是否会自动递增。

```javascript
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
      res(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log("upgrade -> ", event);
      // 创建表
      if (event.oldVersion === 0) {
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
```

**注意点**：

1. `onupgradeneeded`在`success`之前进行，所以可以在其中创建对应的表，并且也可以复用`success`中处理返回db的操作

2. 只有在`upgradeneeded`这个事件中才能够去调用这个`createObjectStore`，如果我们需要重新新建一个Store，那么我们必须重新创建一个`dataBase`就是新创建一个版本**在数据库连接的情况下，因为调用的是open方法是开启的，所以无法再次打开同一个数据库，所以需要先把之前的那个数据库关闭，再开一个新版本的数据库，很重要**

   ```javascript
   function createTable() {
     instance.value.close();
     openDataBase("pd-indexeddb", 2, "tools", ["name", "way", "useWay", "id"])
       .then(() => {
         console.log("create ok");
       })
       .catch((err) => {
         console.log(err);
       });
   }
   ```

   



### 3.3 新增数据

数据的增删改查都需要用到事务，并且获取对应的ObjectStore对象来进行操作，其具体操作如下：

1. 使用`db.transaction`来创建一个事务，其参数是需要查询表的名称（string | string[]）
2. 调用事务的`objectStore`来获取指定的表
3. 调用对应的方法进行操作，比如增删改

新增数据需要使用事务来进行，通过事务的`add`方法来进行操作即可

```javascript
export function add(db, storeName, data) {
  const tx = db.transaction(storeName, "readwrite");
  const request = tx.objectStore(storeName).add(data);

  return new Promise((res, rej) => {
    request.onsuccess = () => res(true);
    request.onerror = () => rej();
  });
}
```



### 3.4 读取数据

读取数据和新增数据一样，也需要用到事务，需要注意的是查询的结果是返回在**ObjectStore**查询的**result**中的

```javascript
export function read(db, storeName, id) {
  console.log(db);
  const tx = db.transaction(storeName);
  const objectStore = tx.objectStore(storeName);
  // 使用getAll方法可以直接获取所有的数据
  const request = id ? objectStore.get(id) : objectStore.getAll();

  return new Promise((res, rej) => {
    request.onsuccess = (event) => {
      if (request.result) {
        // 这里的结果是在request中而不是event中
        res(request.result);
      } else {
        res(id ? {} : []);
      }
    };

    request.onerror = rej;
  });
}
```



### 3.5 更新数据

更新数据使用ObjectStore中的方法是`put`

```javascript
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
```

这里需要注意的是，这里的update是直接替换对应key的值，所以如果需要只更新部分值的话，按照上面的配置是不行的，需要单独**先查出上一次的值，手动做合并**



### 3.6 删除数据

使用`delete`方法，具体用法如下

```javascript
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

```



### 3.7 更换索引查询

使用`index`方法可以**切换store查询的索引**，即可以从主键查询变为某个字段的查询~

```javascript
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
```



## 参考资料

[网道IndexedDB API](https://wangdoc.com/javascript/bom/indexeddb.html#indexeddb-%E5%AF%B9%E8%B1%A1)