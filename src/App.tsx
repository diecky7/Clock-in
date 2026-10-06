import EntryForm from './screens/EntryForm'
import ExpenseForm from './screens/ExpenseForm'
import Export from './screens/Export'
import Home from './screens/Home'
import Places from './screens/Places'
import EmployerEdit from './screens/EmployerEdit'
import ScheduleEdit from './screens/ScheduleEdit'
import Settings from './screens/Settings'
import { useRoute } from './router'

export default function App() {
  const route = useRoute()
  switch (route.path) {
    case '/places':
      return <Places />
    case '/settings':
      return <Settings />
    case '/settings/schedule':
      return <ScheduleEdit />
    case '/settings/employer/:id':
      return <EmployerEdit key={route.params.id} id={route.params.id} />
    case '/entry/new':
      return <EntryForm key="new" />
    case '/entry/:id':
      return <EntryForm key={route.params.id} id={route.params.id} />
    case '/expense/new':
      return <ExpenseForm key="new" />
    case '/expense/:id':
      return <ExpenseForm key={route.params.id} id={route.params.id} />
    case '/export':
      return <Export key={route.params.week ?? 'now'} week={route.params.week} />
    default:
      return <Home />
  }
}
