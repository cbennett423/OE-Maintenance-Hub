import { useParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'

export default function UnitProfile() {
  const { id } = useParams()

  return (
    <div>
      <PageHeader title={`Unit ${id}`} />
      <p className="text-muted">Unit profile coming in Phase 2.</p>
    </div>
  )
}
