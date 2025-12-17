import { type OnStart, Service } from '@flamework/core'
import { Players } from '@rbxts/services'

@Service({})
export class LeaderboardService implements OnStart {
  onStart() {
    Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player))

    for (const player of Players.GetPlayers()) {
      this.onPlayerAdded(player)
    }
  }

  private onPlayerAdded(player: Player) {
    const leaderstats = new Instance('Folder')
    leaderstats.Name = 'leaderstats'
    leaderstats.Parent = player

    const points = new Instance('IntValue')
    points.Name = 'Points'
    points.Value = 0
    points.Parent = leaderstats
  }
}
