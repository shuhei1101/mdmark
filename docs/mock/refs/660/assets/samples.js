// #660 のモックの見本: C4Container・C4Component・C4Dynamic・C4Deployment の Mermaid と補足（文書の map の範囲に記載する Mermaid と補足に該当する）

export const CONTAINER = `C4Container
  title 注文のシステムのコンテナ
  Person(customer, "顧客", "商品を注文する人")
  System_Ext(pay, "決済代行", "カードの決済")
  Container_Boundary(shop, "注文のシステム") {
    Container(web, "注文の画面", "React", "商品を選んで注文する")
    Container(api, "注文の API", "Node.js", "注文と支払いを受け付ける")
    ContainerDb(db, "注文のデータベース", "PostgreSQL", "注文と明細を保存する")
    ContainerQueue(queue, "通知の待ち行列", "SQS", "発送の通知を順に送る")
  }
  Container_Ext(mail, "メールの配信", "SendGrid", "通知のメールを送る")
  Rel(customer, web, "注文する", "HTTPS")
  Rel(web, api, "注文を送る", "JSON/HTTPS")
  Rel_D(api, db, "保存する", "SQL")
  Rel(api, queue, "通知を積む")
  BiRel(api, pay, "決済する")
  Rel(queue, mail, "送信を頼む")
`;

export const CONTAINER_DATA = { version: 1, notes: { api: { text: "注文の受付から通知までを持つ" } }, layout: {} };

export const COMPONENT = `C4Component
  title 注文の API のコンポーネント
  Container_Boundary(api, "注文の API") {
    Component(router, "受付", "Express", "要求を振り分ける")
    Component(order, "注文の処理", "TypeScript", "在庫と支払いを確かめる")
    ComponentDb(repo, "注文の保存", "Prisma", "注文を読み書きする")
    ComponentQueue(notify, "通知の送信", "SQS SDK", "通知を待ち行列へ積む")
  }
  Component_Ext(pay, "決済の SDK", "Stripe", "決済代行を呼ぶ")
  Rel(router, order, "注文を渡す")
  Rel(order, repo, "保存する")
  Rel(order, notify, "通知を積む")
  Rel(order, pay, "決済する", "HTTPS")
`;

export const COMPONENT_DATA = { version: 1, notes: { order: { text: "注文の入力を確かめてから保存する" } }, layout: {} };

export const DYNAMIC = `C4Dynamic
  title 注文の流れ
  Person(customer, "顧客")
  Container(web, "注文の画面", "React")
  Container(api, "注文の API", "Node.js")
  ContainerDb(db, "注文のデータベース", "PostgreSQL")
  Rel(customer, web, "注文を入力する")
  Rel(web, api, "注文を送る", "JSON/HTTPS")
  RelIndex(5, api, db, "注文を保存する", "SQL")
  Rel(api, web, "受付の番号を返す")
`;

export const DYNAMIC_DATA = { version: 1, notes: {}, layout: {} };

export const DEPLOYMENT = `C4Deployment
  title 注文のシステムの配置
  Deployment_Node(cloud, "クラウド", "AWS") {
    Deployment_Node(region, "東京のリージョン", "ap-northeast-1") {
      Node_L(app, "アプリのサーバー", "ECS Fargate") {
        Container(api, "注文の API", "Node.js", "注文と支払いを受け付ける")
      }
      Node_R(dbnode, "データベースのサーバー", "RDS") {
        ContainerDb(db, "注文のデータベース", "PostgreSQL", "注文と明細を保存する")
      }
    }
  }
  Deployment_Node(browser, "利用者の端末", "ブラウザ") {
    Container(web, "注文の画面", "React", "商品を選んで注文する")
  }
  Rel(web, api, "注文を送る", "HTTPS")
  Rel(api, db, "保存する", "SQL")
`;

export const DEPLOYMENT_DATA = { version: 1, notes: { api: { text: "2 台で動かす" } }, layout: {} };

export const UNREADABLE = `C4Container
  title 読めない行を持つコンテナ図
  Person(customer, "顧客")
  Container(web, "注文の画面", "React")
  Container(api "注文の API")
  Rel(customer, web, "注文する")
  Rel(web, api, "注文を送る")
`;
