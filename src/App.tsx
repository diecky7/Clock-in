import Home from './screens/Home'
import EmployerEdit from './screens/EmployerEdit'
import ScheduleEdit from './screens/ScheduleEdit'
import Settings from './screens/Settings'
import { useRoute } from './router'

export default function App() {
  const route = useRoute()
  switch (route.path) {
    case '/settings':
      return <Settings />
    case '/settings/schedule':
      return <ScheduleEdit />
    case '/settings/employer/:id':
      return <EmployerEdit key={route.params.id} id={route.params.id} />
    default:
      return <Home />
  }
}
