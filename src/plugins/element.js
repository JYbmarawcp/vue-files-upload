import Vue from 'vue'
import { 
  Button,
  ButtonGroup,
  Collapse,
  CollapseItem,
  Progress,
  Table,
  TableColumn,
  Notification,
  Message
} from 'element-ui'

Vue.use(Button)
Vue.use(ButtonGroup)
Vue.use(Collapse)
Vue.use(CollapseItem)
Vue.use(Progress)
Vue.use(Table)
Vue.use(TableColumn)
Vue.prototype.$notify = Notification;
Vue.prototype.$message = Message;
