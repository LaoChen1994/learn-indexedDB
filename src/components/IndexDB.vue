<template>
  <div>
    <div class="dataset">
      <table>
        <tr>
          <th>ID</th>
          <th>名称</th>
          <th>性别</th>
          <th>年龄</th>
          <th>爱好</th>
        </tr>
        <tbody>
          <tr v-for="person in list" :key="person.id">
            <td>{{ person.id }}</td>
            <td>{{ person.name }}</td>
            <td>{{ person.sex }}</td>
            <td>{{ person.age }}</td>
            <td>{{ (person.hobbies || []).join(",") }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="action">
      <button @click="addItem">add</button>
      <button @click="updateItem">update</button>
      <button @click="removeItem">delete</button>
      <button @click="searchIndex">query 张三</button>
      <button @click="createTable">Create Store</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { openDataBase, add, read, update, remove, queryByIndex } from "../db";

const instance = ref(null);
const list = ref([]);

onMounted(() => {
  openDataBase("pd-indexeddb", 1, "user", [
    "name",
    "sex",
    "hobbies",
    "id",
    "age",
  ])
    .then((db) => {
      instance.value = db;
      read(db, "user").then((data) => {
        console.log("data =>", data);
        list.value = data;
      });
    })
    .catch((e) => {
      console.log(e);
    });
});

function addItem() {
  if (instance.value) {
    add(instance.value, "user", {
      name: "李四",
      sex: 1,
      hobbies: [],
      age: 18,
    });
  }
}

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

function updateItem() {
  update(instance.value, "user", { id: 1, name: "张三啊" })
    .then(() => {
      console.log("update ok");
    })
    .catch((e) => {
      console.log(e);
    });
}

function removeItem() {
  remove(instance.value, "user", 1);
}

function searchIndex() {
  queryByIndex(instance.value, "user", "name", "张三").then((data) => {
    console.log(data);
  });
}
</script>

<style>
table {
  border: 1px solid #f44;
}
</style>